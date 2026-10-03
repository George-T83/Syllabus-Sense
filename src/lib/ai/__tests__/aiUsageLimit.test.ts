// @vitest-environment node
//
// aiUsageLimit.ts imports adminFirestore.ts, which throws if `window` is
// defined (firebase-admin must never load in client code) - the project's
// default test environment is jsdom, so this file needs the real Node
// environment instead, same reasoning as any other server-only module test.
import { describe, it, expect, afterEach } from 'vitest';
import { decideAiUsage, decideAiCall, checkAndIncrementAiUsage } from '../aiUsageLimit';

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

describe('decideAiCall', () => {
  it('allows a call under both limits and reports the per-user remainder', () => {
    expect(decideAiCall({ globalCount: 5, globalLimit: 10, userCount: 2, userLimit: 5 })).toEqual({
      allowed: true,
      userRemaining: 2,
    });
  });

  it('refuses once the global budget is spent, whatever the user count', () => {
    expect(decideAiCall({ globalCount: 10, globalLimit: 10, userCount: 0, userLimit: 5 })).toEqual({
      allowed: false,
      reason: 'global_limit',
      userRemaining: null,
    });
    expect(decideAiCall({ globalCount: 10, globalLimit: 10, userCount: null })).toMatchObject({
      allowed: false,
      reason: 'global_limit',
    });
  });

  it('refuses a user over their own limit while the global budget remains', () => {
    expect(decideAiCall({ globalCount: 1, globalLimit: 10, userCount: 5, userLimit: 5 })).toEqual({
      allowed: false,
      reason: 'user_limit',
      userRemaining: 0,
    });
  });

  it('checks the global budget first, so it wins when both are exhausted', () => {
    expect(
      decideAiCall({ globalCount: 10, globalLimit: 10, userCount: 5, userLimit: 5 }),
    ).toMatchObject({
      reason: 'global_limit',
    });
  });

  it('allows an unmetered caller (no per-user count) under the global budget', () => {
    expect(decideAiCall({ globalCount: 9, globalLimit: 10, userCount: null })).toEqual({
      allowed: true,
      userRemaining: null,
    });
  });
});
