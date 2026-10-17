// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const mockVerifyToken = vi.fn();
const mockCreate = vi.fn();

vi.mock('@/lib/auth/verifyFirebaseIdToken', () => ({
  verifyFirebaseIdToken: (...args: unknown[]) => mockVerifyToken(...args),
}));
vi.mock('@/lib/ai/anthropic', () => ({
  getAnthropicClient: () => ({ messages: { create: (...a: unknown[]) => mockCreate(...a) } }),
  SYLLABUS_EXTRACTION_MODEL: 'test-model',
}));

import { POST } from '@/app/api/syllabus/extract/route';

const PDF = 'JVBERi0xLjQK';
const call = () =>
  POST(
    new NextRequest('http://localhost:3000/api/syllabus/extract', {
      method: 'POST',
      headers: { Authorization: 'Bearer t', 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileBase64: PDF, fileName: 's.pdf' }),
    }),
  );

const reply = (input: unknown, stop_reason = 'tool_use') => ({
  stop_reason,
  content: [{ type: 'tool_use', name: 'record_syllabus_extraction', input }],
});
const good = {
  course: { code: 'CS101', title: 'Intro' },
  scheduleItems: [
    { title: 'PS1', type: 'assignment', dueDate: '2026-09-10', dateConfidence: 'exact' },
  ],
};

function apiError(status: number, message: string, headers: Record<string, string> = {}) {
  return Anthropic.APIError.generate(status, { error: { message } }, message, new Headers(headers));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  process.env.FIREBASE_ADMIN_PROJECT_ID = 'test-project';
  mockVerifyToken.mockResolvedValue({ uid: 'u1' });
});

describe('extract route: reliability', () => {
  it('asks again with a larger budget when the first reply was cut off', async () => {
    mockCreate.mockResolvedValueOnce(reply({}, 'max_tokens')).mockResolvedValueOnce(reply(good));
    const res = await call();
    expect(res.status).toBe(200);
    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(mockCreate.mock.calls[0][0].max_tokens).toBe(8000);
    expect(mockCreate.mock.calls[1][0].max_tokens).toBe(16000);
    const json = await res.json();
    expect(json.result.course.code).toBe('CS 101');
  });

  it('says the syllabus is too long, not "malformed", when it is still cut off', async () => {
    mockCreate.mockResolvedValue(reply({}, 'max_tokens'));
    const res = await call();
    expect(res.status).toBe(422);
    expect((await res.json()).error).toMatch(/longer than the AI/);
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  it('does not retry a reply that finished normally', async () => {
    mockCreate.mockResolvedValueOnce(reply(good));
    await call();
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it('keeps the usable part of a partly bad extraction and lists what was lost', async () => {
    mockCreate.mockResolvedValueOnce(
      reply({
        course: { code: 'CS101', title: 'Intro', notes: 'n'.repeat(1500) },
        scheduleItems: [
          { title: 'PS1', type: 'assignment', dueDate: '2026-09-10', dateConfidence: 'exact' },
          { title: 'Midterm', type: 'exam', dueDate: 'sometime', dateConfidence: 'exact' },
        ],
      }),
    );
    const res = await call();
    expect(res.status).toBe(200);
    const { result } = await res.json();
    expect(result.scheduleItems).toHaveLength(1);
    expect(result.unresolved.join(' ')).toContain('"Midterm"');
  });

  it('only fails as malformed when the course itself is unusable', async () => {
    mockCreate.mockResolvedValueOnce(reply({ scheduleItems: [] }));
    const res = await call();
    expect(res.status).toBe(502);
    expect((await res.json()).error).toMatch(/malformed/);
  });

  it("reports the provider being busy as 503 with Retry-After, never as the student's daily limit", async () => {
    mockCreate.mockRejectedValueOnce(apiError(429, 'rate limit', { 'retry-after': '30' }));
    const res = await call();
    expect(res.status).toBe(503);
    expect(res.headers.get('Retry-After')).toBe('30');
    expect((await res.json()).error).toMatch(/busy/);
  });

  it('treats an overloaded provider the same way', async () => {
    mockCreate.mockRejectedValueOnce(apiError(529, 'overloaded'));
    expect((await call()).status).toBe(503);
  });

  it('does not expose a bad provider key to the student', async () => {
    mockCreate.mockRejectedValueOnce(apiError(401, 'invalid x-api-key sk-ant-secret'));
    const res = await call();
    expect(res.status).toBe(503);
    expect(JSON.stringify(await res.json())).not.toMatch(/sk-ant|x-api-key/);
  });

  it('turns a document over the provider\'s page limit into "too long"', async () => {
    mockCreate.mockRejectedValueOnce(apiError(400, 'A maximum of 100 PDF pages may be provided.'));
    const res = await call();
    expect(res.status).toBe(422);
    expect((await res.json()).error).toMatch(/longer than the AI/);
  });

  it('keeps any other provider failure a plain 502', async () => {
    mockCreate.mockRejectedValueOnce(new Error('boom'));
    expect((await call()).status).toBe(502);
  });
});
