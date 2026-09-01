import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { __resetMemoryRateLimitStore } from '@/lib/security/rateLimit';

const mockGeneratePasswordResetLink = vi.fn();

vi.mock('@/lib/firebase/admin', () => ({
  adminAuth: {
    generatePasswordResetLink: (...args: unknown[]) => mockGeneratePasswordResetLink(...args),
  },
}));

vi.mock('@/lib/email/passwordResetEmailTemplate', () => ({
  renderPasswordResetEmailHtml: () => '<html>reset</html>',
}));

import { POST } from '@/app/api/auth/reset-password/route';

function makeRequest(email: string | undefined, ip = '203.0.113.7') {
  return new NextRequest('http://localhost:3000/api/auth/reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify({ email }),
  });
}

describe('/api/auth/reset-password route contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __resetMemoryRateLimitStore();
    mockGeneratePasswordResetLink.mockResolvedValue('https://example.com/reset?oob=abc');
  });

  it('rejects a request with no email with 400', async () => {
    const res = await POST(makeRequest(undefined, '203.0.113.100'));
    expect(res.status).toBe(400);
  });

  it('generates a reset link for a valid request', async () => {
    const res = await POST(makeRequest('student@example.edu', '203.0.113.101'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(mockGeneratePasswordResetLink).toHaveBeenCalledWith(
      'student@example.edu',
      expect.any(Object),
    );
  });

  it('rate-limits a single IP after 5 requests within the window (429)', async () => {
    const ip = '203.0.113.42';
    for (let i = 0; i < 5; i++) {
      const res = await POST(makeRequest('student@example.edu', ip));
      expect(res.status).not.toBe(429);
    }

    const blocked = await POST(makeRequest('student@example.edu', ip));
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get('Retry-After')).toBeTruthy();
    // The 6th call to generatePasswordResetLink never happens - blocked
    // before any Firebase Admin or email work is done.
    expect(mockGeneratePasswordResetLink).toHaveBeenCalledTimes(5);
  });

  it('does not let a different IP be blocked by another IP exhausting its budget', async () => {
    const exhaustedIp = '203.0.113.50';
    for (let i = 0; i < 6; i++) {
      await POST(makeRequest('student@example.edu', exhaustedIp));
    }

    const otherIpRes = await POST(makeRequest('student@example.edu', '203.0.113.51'));
    expect(otherIpRes.status).toBe(200);
  });
});
