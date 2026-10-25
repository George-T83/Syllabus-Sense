import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const requireUser = vi.fn();
vi.mock('@/lib/auth/requireUser', () => ({ requireUser: (...a: unknown[]) => requireUser(...a) }));
vi.mock('@/lib/syllabus/extractRawText', () => ({
  detectSyllabusFileKind: () => 'pdf',
  extractRawSyllabusText: async () => 'syllabus text',
}));

import { POST } from '../extract-text/route';

function call() {
  return POST(
    new NextRequest('http://localhost/api/syllabus/extract-text', {
      method: 'POST',
      body: JSON.stringify({ fileBase64: 'JVBERi0xLjQ=' }),
    }),
  );
}

describe('POST /api/syllabus/extract-text rate limit', () => {
  beforeEach(() => requireUser.mockReset());

  it('answers 429 with Retry-After after 20 calls in a minute, per account', async () => {
    requireUser.mockResolvedValue({ uid: 'busy-user' });
    for (let i = 0; i < 20; i++) expect((await call()).status).toBe(200);
    const blocked = await call();
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get('Retry-After'))).toBeGreaterThan(0);
    expect((await blocked.json()).error).toMatch(/too many requests/i);

    requireUser.mockResolvedValue({ uid: 'other-user' });
    expect((await call()).status).toBe(200);
  });

  it('still answers 401 before counting anything when signed out', async () => {
    requireUser.mockResolvedValue(null);
    expect((await call()).status).toBe(401);
  });
});
