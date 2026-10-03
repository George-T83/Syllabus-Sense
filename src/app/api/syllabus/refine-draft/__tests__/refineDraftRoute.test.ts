// @vitest-environment node
import { describe, it, expect, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockAnthropicCreate = vi.fn();
vi.mock('@/lib/auth/verifyFirebaseIdToken', () => ({ verifyFirebaseIdToken: vi.fn() }));
vi.mock('@/lib/ai/anthropic', () => ({
  getAnthropicClient: () => ({
    messages: { create: (...a: unknown[]) => mockAnthropicCreate(...a) },
  }),
  SYLLABUS_EXTRACTION_MODEL: 'test-model',
}));

import { POST } from '../route';

const request = () =>
  new NextRequest('http://localhost:3000/api/syllabus/refine-draft', {
    method: 'POST',
    body: JSON.stringify({ message: 'Change the final to 40%', draft: { courseCode: 'CS 301' } }),
  });

describe('refine-draft route authentication', () => {
  afterEach(() => vi.unstubAllEnvs());

  it.each([
    ['with the admin project set', 'my-project'],
    ['with the admin project NOT set', ''],
  ])('refuses a signed-out request in production %s', async (_label, projectId) => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('FIREBASE_ADMIN_PROJECT_ID', projectId);
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID', '');
    const res = await POST(request());
    expect(res.status).toBe(401);
    expect(mockAnthropicCreate).not.toHaveBeenCalled();
  });

  it('still answers a signed-out request outside production (local dev)', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('FIREBASE_ADMIN_PROJECT_ID', '');
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID', '');
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    const res = await POST(request());
    expect(res.status).not.toBe(401);
  });
});
