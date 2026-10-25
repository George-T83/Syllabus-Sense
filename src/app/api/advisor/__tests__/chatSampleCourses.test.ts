// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth/requireUser', () => ({ requireUser: async () => ({ uid: 'u1' }) }));
vi.mock('@/lib/ai/aiUsageLimit', () => ({
  checkAndIncrementAiUsage: async () => ({ allowed: true, remaining: 10, limit: 60 }),
}));
vi.mock('@/lib/ai/anthropic', () => ({
  SYLLABUS_EXTRACTION_MODEL: 'test',
  getAnthropicClient: () => {
    throw new Error('no key');
  },
}));
const offlineReply = vi.fn(() => ({ reply: 'ok', offline: true }));
vi.mock('@/lib/advisor/offlineAdvisor', () => ({
  generateOfflineAdvisorReply: (...a: unknown[]) =>
    (offlineReply as (...x: unknown[]) => unknown)(...a),
}));

import { POST } from '../chat/route';

describe('POST /api/advisor/chat', () => {
  it('ignores courses flagged as sample data, even if the client sends them', async () => {
    const res = await POST(
      new NextRequest('http://localhost/api/advisor/chat', {
        method: 'POST',
        body: JSON.stringify({
          message: 'What should I take next?',
          courses: [
            { code: 'BIO 101', title: 'Biology', term: 'Fall 2026' },
            { code: 'SAMPLE 100', title: 'Made-up course', term: 'Fall 2026', sample: true },
          ],
        }),
      }),
    );
    expect(res.status).toBe(200);
    const context = (offlineReply.mock.calls[0] as unknown[])[1] as { courses: { code: string }[] };
    expect(context.courses.map((c) => c.code)).toEqual(['BIO 101']);
  });
});
