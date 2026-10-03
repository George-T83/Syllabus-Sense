// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

/** A tiny in-memory stand-in for the parts of Firestore the budget uses. */
const store = new Map<string, Record<string, unknown>>();
const fakeDb = {
  doc: (path: string) => ({ path }),
  runTransaction: async <T>(fn: (tx: unknown) => Promise<T>) => {
    const writes: Array<[string, Record<string, unknown>]> = [];
    const tx = {
      get: async (ref: { path: string }) => ({
        exists: store.has(ref.path),
        data: () => store.get(ref.path),
      }),
      set: (ref: { path: string }, data: Record<string, unknown>) => {
        writes.push([ref.path, data]);
      },
    };
    const result = await fn(tx);
    writes.forEach(([path, data]) => store.set(path, { ...(store.get(path) ?? {}), ...data }));
    return result;
  },
};

vi.mock('@/lib/firebase/adminFirestore', () => ({ adminDb: fakeDb }));

async function load(limit: string) {
  vi.resetModules();
  process.env.AI_GLOBAL_DAILY_CALL_LIMIT = limit;
  return import('../aiUsageLimit');
}

const todayKey = () => `aiBudget/${new Date().toISOString().slice(0, 10)}`;

describe('global daily AI budget', () => {
  beforeEach(() => {
    store.clear();
    delete process.env.AI_GLOBAL_DAILY_CALL_LIMIT;
  });

  it('reads the limit from AI_GLOBAL_DAILY_CALL_LIMIT and falls back to 1000', async () => {
    expect((await load('7')).AI_GLOBAL_DAILY_CALL_LIMIT).toBe(7);
    expect((await load('abc')).AI_GLOBAL_DAILY_CALL_LIMIT).toBe(1000);
    expect((await load('-5')).AI_GLOBAL_DAILY_CALL_LIMIT).toBe(1000);
  });

  it('allows calls up to the limit, then refuses with a global reason', async () => {
    const { checkAndIncrementAiUsage } = await load('3');
    const caller = { uid: 'u1', email: 'a@b.test' };

    for (let i = 0; i < 3; i++) {
      expect((await checkAndIncrementAiUsage(caller)).allowed).toBe(true);
    }
    const refused = await checkAndIncrementAiUsage(caller);
    expect(refused).toMatchObject({ allowed: false, reason: 'global_limit', limit: 3 });
    expect(store.get(todayKey())?.count).toBe(3);
  });

  it('shares one budget across different accounts and anonymous callers', async () => {
    const { checkAndIncrementAiUsage } = await load('3');
    expect((await checkAndIncrementAiUsage({ uid: 'u1' })).allowed).toBe(true);
    expect((await checkAndIncrementAiUsage({ uid: 'u2' })).allowed).toBe(true);
    expect((await checkAndIncrementAiUsage(null)).allowed).toBe(true);
    expect(await checkAndIncrementAiUsage({ uid: 'u3' })).toMatchObject({
      allowed: false,
      reason: 'global_limit',
    });
    expect(await checkAndIncrementAiUsage(null)).toMatchObject({ allowed: false });
  });

  it('does not count a refused call', async () => {
    const { checkAndIncrementAiUsage } = await load('1');
    await checkAndIncrementAiUsage({ uid: 'u1' });
    await checkAndIncrementAiUsage({ uid: 'u1' });
    await checkAndIncrementAiUsage({ uid: 'u1' });
    expect(store.get(todayKey())?.count).toBe(1);
  });

  it('keeps the per-user cap switched off: callers are unlimited until the budget is spent', async () => {
    const { checkAndIncrementAiUsage } = await load('2');
    expect(await checkAndIncrementAiUsage({ uid: 'u1' })).toEqual({
      allowed: true,
      remaining: Infinity,
      limit: Infinity,
      unlimited: true,
    });
    // No per-user document is created while that cap is off.
    expect([...store.keys()].some((k) => k.startsWith('users/'))).toBe(false);
  });
});
