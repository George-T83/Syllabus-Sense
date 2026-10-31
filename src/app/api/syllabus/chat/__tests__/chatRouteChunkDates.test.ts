// @vitest-environment node
//
// Due-date and hours handling for AI-suggested chunks (backlog B-55..B-58).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockVerifyToken = vi.fn();
const mockAnthropicCreate = vi.fn();

vi.mock('@/lib/auth/verifyFirebaseIdToken', () => ({
  verifyFirebaseIdToken: (...args: unknown[]) => mockVerifyToken(...args),
}));

vi.mock('@/lib/ai/anthropic', () => ({
  getAnthropicClient: () => ({
    messages: { create: (...args: unknown[]) => mockAnthropicCreate(...args) },
  }),
  SYLLABUS_EXTRACTION_MODEL: 'claude-sonnet-5',
}));

import { POST } from '../route';

const AI_ANSWER = 'Here is how to split the project into steps.';

function modelReply(chunks: unknown[]): void {
  mockAnthropicCreate.mockResolvedValue({
    content: [
      {
        type: 'text',
        text: `${AI_ANSWER}\n\n---SUGGESTED_CHUNKS_START---\n${JSON.stringify(chunks)}\n---SUGGESTED_CHUNKS_END---`,
      },
    ],
  });
}

function chunk(overrides: Record<string, unknown> = {}) {
  return {
    title: 'Step',
    notes: '',
    estimatedHours: 2,
    dueDateOffsetDays: 3,
    type: 'project',
    ...overrides,
  };
}

async function ask(extra: Record<string, unknown> = {}) {
  const req = new NextRequest('http://localhost:3000/api/syllabus/chat', {
    method: 'POST',
    body: JSON.stringify({ message: 'Break down my final project', ...extra }),
  });
  const res = await POST(req);
  expect(res.status).toBe(200);
  return res.json();
}

describe('suggested chunk dates and hours', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ANTHROPIC_API_KEY = 'test-api-key';
    // Server clock: 02:00 UTC on Oct 26 - still the evening of Oct 25 in Chicago.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-26T02:00:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('B-55: an offset of 0 stays on the same day instead of becoming tomorrow', async () => {
    modelReply([chunk({ title: 'Start today', dueDateOffsetDays: 0 })]);
    const data = await ask({ todayKey: '2026-10-25' });
    expect(data.suggestedChunks[0].dueDate).toBe('2026-10-25');
  });

  it('B-55: a missing offset still falls back to tomorrow', async () => {
    modelReply([chunk({ dueDateOffsetDays: undefined })]);
    const data = await ask({ todayKey: '2026-10-25' });
    expect(data.suggestedChunks[0].dueDate).toBe('2026-10-26');
  });

  it('B-56: a huge offset drops only that chunk and keeps the AI answer and the valid chunks', async () => {
    modelReply([
      chunk({ title: 'Fine', dueDateOffsetDays: 4 }),
      chunk({ title: 'Absurd', dueDateOffsetDays: 1e15 }),
      chunk({ title: 'Also fine', dueDateOffsetDays: 6 }),
    ]);
    const data = await ask({ todayKey: '2026-10-25' });
    expect(data.reply).toContain(AI_ANSWER);
    expect(data.suggestedChunks.map((c: { title: string }) => c.title)).toEqual([
      'Fine',
      'Also fine',
    ]);
    expect(data.reply).toMatch(/Absurd/);
    expect(data.reply).toMatch(/skipped/i);
  });

  it('B-57: a negative offset is rejected with a clear message', async () => {
    modelReply([
      chunk({ title: 'In the past', dueDateOffsetDays: -3 }),
      chunk({ title: 'Ok', dueDateOffsetDays: 2 }),
    ]);
    const data = await ask({ todayKey: '2026-10-25' });
    expect(data.suggestedChunks).toHaveLength(1);
    expect(data.suggestedChunks[0].title).toBe('Ok');
    expect(data.reply).toMatch(/In the past/);
    expect(data.reply).toMatch(/before today/i);
  });

  it('B-57: negative estimated hours are rejected with a clear message', async () => {
    modelReply([
      chunk({ title: 'Negative time', estimatedHours: -2 }),
      chunk({ title: 'Ok', estimatedHours: 1.5 }),
    ]);
    const data = await ask({ todayKey: '2026-10-25' });
    expect(data.suggestedChunks).toHaveLength(1);
    expect(data.suggestedChunks[0]).toMatchObject({ title: 'Ok', estimatedHours: 1.5 });
    expect(data.reply).toMatch(/Negative time/);
    expect(data.reply).toMatch(/hours/i);
  });

  it("B-58: offsets count from the student's day, not the server's UTC day", async () => {
    modelReply([chunk({ dueDateOffsetDays: 0 }), chunk({ dueDateOffsetDays: 2 })]);
    const data = await ask({ todayKey: '2026-10-25' });
    expect(data.suggestedChunks.map((c: { dueDate: string }) => c.dueDate)).toEqual([
      '2026-10-25',
      '2026-10-27',
    ]);
  });

  it('B-58: falls back to the server UTC day when the client sends no usable day', async () => {
    modelReply([chunk({ dueDateOffsetDays: 0 })]);
    for (const bad of [undefined, 'tomorrow', '2026-13-45', '2031-01-01']) {
      const data = await ask({ todayKey: bad });
      expect(data.suggestedChunks[0].dueDate).toBe('2026-10-26');
    }
  });
});
