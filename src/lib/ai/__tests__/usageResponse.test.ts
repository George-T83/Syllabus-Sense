// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { aiUsageDeniedResponse, secondsUntilUtcMidnight } from '../usageResponse';

describe('secondsUntilUtcMidnight', () => {
  it('counts down to the next UTC midnight', () => {
    expect(secondsUntilUtcMidnight(new Date('2026-10-02T23:00:00Z'))).toBe(3600);
    expect(secondsUntilUtcMidnight(new Date('2026-10-02T00:00:00Z'))).toBe(86400);
  });

  it('is never zero', () => {
    expect(secondsUntilUtcMidnight(new Date('2026-10-02T23:59:59.999Z'))).toBeGreaterThanOrEqual(1);
  });
});

describe('aiUsageDeniedResponse', () => {
  it('answers a per-user refusal with the familiar 429', async () => {
    const res = aiUsageDeniedResponse({
      allowed: false,
      remaining: 0,
      limit: 60,
      unlimited: false,
      reason: 'user_limit',
    });
    expect(res.status).toBe(429);
    expect((await res.json()).error).toMatch(/60 requests\/day/);
  });

  it('answers a global refusal with 503, a Retry-After and a stable code', async () => {
    const res = aiUsageDeniedResponse(
      { allowed: false, remaining: 0, limit: 1000, unlimited: true, reason: 'global_limit' },
      new Date('2026-10-02T22:00:00Z'),
    );
    expect(res.status).toBe(503);
    expect(res.headers.get('retry-after')).toBe('7200');
    const body = await res.json();
    expect(body.code).toBe('ai_budget_exhausted');
    expect(body.error).toMatch(/paused for the rest of today/);
  });
});
