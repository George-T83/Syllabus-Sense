import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { checkRateLimit, __resetMemoryRateLimitStore } from '../rateLimit';

describe('checkRateLimit (in-memory backend)', () => {
  beforeEach(() => {
    __resetMemoryRateLimitStore();
    // No Upstash env vars set in the test environment, so every check below
    // exercises the in-memory backend - asserted explicitly via `backend`
    // on each result rather than assumed.
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('allows requests under the limit and reports remaining budget', async () => {
    const first = await checkRateLimit('test:a', { limit: 3, windowMs: 60_000 });
    expect(first.allowed).toBe(true);
    expect(first.backend).toBe('memory');
    expect(first.remaining).toBe(2);

    const second = await checkRateLimit('test:a', { limit: 3, windowMs: 60_000 });
    expect(second.allowed).toBe(true);
    expect(second.remaining).toBe(1);
  });

  it('blocks once the limit is exceeded within the window', async () => {
    const opts = { limit: 2, windowMs: 60_000 };
    await checkRateLimit('test:b', opts);
    await checkRateLimit('test:b', opts);
    const third = await checkRateLimit('test:b', opts);

    expect(third.allowed).toBe(false);
    expect(third.remaining).toBe(0);
  });

  it('keeps separate counters per key', async () => {
    const opts = { limit: 1, windowMs: 60_000 };
    await checkRateLimit('test:c1', opts);
    const other = await checkRateLimit('test:c2', opts);

    expect(other.allowed).toBe(true);
  });

  it('resets the counter once the window elapses', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const opts = { limit: 1, windowMs: 1_000 };

    const first = await checkRateLimit('test:d', opts);
    expect(first.allowed).toBe(true);

    const second = await checkRateLimit('test:d', opts);
    expect(second.allowed).toBe(false);

    vi.setSystemTime(1_001);
    const third = await checkRateLimit('test:d', opts);
    expect(third.allowed).toBe(true);
  });
});

describe('checkRateLimit (Upstash backend)', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    __resetMemoryRateLimitStore();
    process.env.UPSTASH_REDIS_REST_URL = 'https://example-upstash.io';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';
  });

  afterEach(() => {
    global.fetch = originalFetch;
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  });

  it('allows a request when the pipelined INCR is under the limit', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ result: 1 }, { result: 1 }],
    }) as unknown as typeof fetch;

    const result = await checkRateLimit('test:upstash-a', { limit: 5, windowMs: 60_000 });

    expect(result.backend).toBe('upstash');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
    expect(global.fetch).toHaveBeenCalledWith(
      'https://example-upstash.io/pipeline',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
      }),
    );
  });

  it('blocks once the INCR result exceeds the limit', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ result: 6 }, { result: 1 }],
    }) as unknown as typeof fetch;

    const result = await checkRateLimit('test:upstash-b', { limit: 5, windowMs: 60_000 });

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('fails open to the in-memory backend when Upstash errors', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 }) as unknown as typeof fetch;

    const result = await checkRateLimit('test:upstash-c', { limit: 5, windowMs: 60_000 });

    expect(result.backend).toBe('memory');
    expect(result.allowed).toBe(true);
  });

  it('fails open to the in-memory backend when fetch itself throws', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('network down')) as unknown as typeof fetch;

    const result = await checkRateLimit('test:upstash-d', { limit: 5, windowMs: 60_000 });

    expect(result.backend).toBe('memory');
    expect(result.allowed).toBe(true);
  });
});
