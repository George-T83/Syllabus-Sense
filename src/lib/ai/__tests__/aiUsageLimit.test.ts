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

describe('checkAndIncrementAiUsage exemption allowlist', () => {
  afterEach(() => {
    delete process.env.AI_UNLIMITED_UIDS;
    delete process.env.AI_UNLIMITED_EMAILS;
  });

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

  it('is not exempt when neither uid nor email match the allowlists', async () => {
    process.env.AI_UNLIMITED_UIDS = 'someone-else';
    process.env.AI_UNLIMITED_EMAILS = 'someone@else.edu';
    const result = await checkAndIncrementAiUsage({
      uid: 'a-student',
      email: 'student@campus.edu',
    });
    expect(result.unlimited).toBe(false);
  });

  it('is not exempt when no allowlist env vars are set at all', async () => {
    const result = await checkAndIncrementAiUsage({ uid: 'a-student' });
    expect(result.unlimited).toBe(false);
  });
});
