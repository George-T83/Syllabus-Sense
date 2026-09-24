// @vitest-environment node
//
// aiUsageLimit.ts imports adminFirestore.ts, which throws if `window` is
// defined (firebase-admin must never load in client code) - the project's
// default test environment is jsdom, so this file needs the real Node
// environment instead, same reasoning as any other server-only module test.
import { describe, it, expect, afterEach } from 'vitest';
import { decideAiUsage, checkAndIncrementAiUsage } from '../aiUsageLimit';

describe('decideAiUsage', () => {
  it('allows a call under the limit and reports remaining count after incrementing', () => {
    const result = decideAiUsage(5, 10);
    expect(result).toEqual({ allowed: true, remaining: 4, limit: 10 });
  });

  it('allows the last call right at the boundary', () => {
    const result = decideAiUsage(9, 10);
    expect(result).toEqual({ allowed: true, remaining: 0, limit: 10 });
  });

  it('rejects once the count has reached the limit', () => {
    const result = decideAiUsage(10, 10);
    expect(result).toEqual({ allowed: false, remaining: 0, limit: 10 });
  });

  it('rejects a count already over the limit', () => {
    const result = decideAiUsage(11, 10);
    expect(result).toEqual({ allowed: false, remaining: 0, limit: 10 });
  });

  it('treats a fresh (zero-count) user as allowed', () => {
    const result = decideAiUsage(0, 10);
    expect(result).toEqual({ allowed: true, remaining: 9, limit: 10 });
  });
});

describe('checkAndIncrementAiUsage with the global cap disabled', () => {
  // AI_USAGE_CAP_ENABLED is currently `false` (see docs/AI_USAGE_CAP.md) -
  // every caller passes unconditionally, before the allowlist below is even
  // consulted.
  it('is unlimited for any caller, exempt or not', async () => {
    const result = await checkAndIncrementAiUsage({
      uid: 'a-student',
      email: 'student@campus.edu',
    });
    expect(result).toEqual({
      allowed: true,
      remaining: Infinity,
      limit: Infinity,
      unlimited: true,
    });
  });
});

describe('checkAndIncrementAiUsage exemption allowlist', () => {
  afterEach(() => {
    delete process.env.AI_UNLIMITED_UIDS;
    delete process.env.AI_UNLIMITED_EMAILS;
  });

  // With AI_USAGE_CAP_ENABLED currently `false`, the kill switch above
  // already makes every caller unlimited before `isExempt` is even reached -
  // these two pass today for that reason, not because the allowlist itself
  // was exercised. They start actually testing the allowlist again the
  // moment the cap is re-enabled, which is why they're kept rather than
  // deleted.
  it('is unlimited for a uid in AI_UNLIMITED_UIDS, case-insensitively', async () => {
    process.env.AI_UNLIMITED_UIDS = 'Founder-Uid-123, other-uid';
    const result = await checkAndIncrementAiUsage({ uid: 'founder-uid-123' });
    expect(result).toEqual({
      allowed: true,
      remaining: Infinity,
      limit: Infinity,
      unlimited: true,
    });
  });

  it('is unlimited for an email in AI_UNLIMITED_EMAILS, case-insensitively', async () => {
    process.env.AI_UNLIMITED_EMAILS = 'Founder@Example.edu';
    const result = await checkAndIncrementAiUsage({
      uid: 'some-uid',
      email: 'founder@example.edu',
    });
    expect(result).toEqual({
      allowed: true,
      remaining: Infinity,
      limit: Infinity,
      unlimited: true,
    });
  });
});
