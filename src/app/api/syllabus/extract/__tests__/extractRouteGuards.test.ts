// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockVerifyToken = vi.fn();
const mockAnthropicCreate = vi.fn();
const mockUsage = vi.fn();

vi.mock('@/lib/auth/verifyFirebaseIdToken', () => ({
  verifyFirebaseIdToken: (...args: unknown[]) => mockVerifyToken(...args),
}));
vi.mock('@/lib/ai/anthropic', () => ({
  getAnthropicClient: () => ({
    messages: { create: (...a: unknown[]) => mockAnthropicCreate(...a) },
  }),
  SYLLABUS_EXTRACTION_MODEL: 'test-model',
}));
vi.mock('@/lib/ai/aiUsageLimit', () => ({
  checkAndIncrementAiUsage: (...args: unknown[]) => mockUsage(...args),
}));

import { POST } from '@/app/api/syllabus/extract/route';
import { BODY_LIMITS } from '@/lib/http/readJsonBody';

function post(body: string, headers: Record<string, string> = {}) {
  return new NextRequest('http://localhost:3000/api/syllabus/extract', {
    method: 'POST',
    headers: { authorization: 'Bearer good', ...headers },
    body,
  });
}

describe('/api/syllabus/extract spend guards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.FIREBASE_ADMIN_PROJECT_ID = 'test-project';
    mockVerifyToken.mockResolvedValue({ uid: 'u1' });
    mockUsage.mockResolvedValue({
      allowed: true,
      remaining: Infinity,
      limit: Infinity,
      unlimited: true,
    });
  });

  it('pauses with a 503 and Retry-After when the global budget is spent, before any AI call', async () => {
    mockUsage.mockResolvedValue({
      allowed: false,
      remaining: 0,
      limit: 1000,
      unlimited: true,
      reason: 'global_limit',
    });
    const res = await POST(post(JSON.stringify({ fileBase64: 'JVBERi0xLjQK', fileName: 'a.pdf' })));
    expect(res.status).toBe(503);
    expect(Number(res.headers.get('retry-after'))).toBeGreaterThan(0);
    expect((await res.json()).code).toBe('ai_budget_exhausted');
    expect(mockAnthropicCreate).not.toHaveBeenCalled();
  });

  it('refuses an oversized body with 413 before parsing it or calling the AI', async () => {
    const res = await POST(post('x', { 'content-length': String(BODY_LIMITS.file + 1) }));
    expect(res.status).toBe(413);
    expect(mockAnthropicCreate).not.toHaveBeenCalled();
  });

  it("still answers invalid JSON with the route's own 400", async () => {
    const res = await POST(post('not json'));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Invalid request body.');
  });
});
