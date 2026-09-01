/**
 * Fixed-window request rate limiting for public/expensive API routes.
 *
 * Two backends, chosen automatically:
 *
 * - Upstash Redis (REST API, plain `fetch` - no client library needed) when
 *   `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are set. Counters
 *   live in Redis, so every Vercel Lambda instance (and every region) shares
 *   the same count - the only backend that's correct under real concurrent
 *   traffic across serverless instances. This is what production should run.
 * - In-memory `Map`, otherwise. Correct within a single warm instance, but a
 *   cold start clears it and a request that lands on a different instance
 *   gets its own counter - so it under-counts, not over-counts, across
 *   instances. Good enough for local dev and for a preview deploy without
 *   Upstash credentials provisioned; not a substitute for Upstash in
 *   production. `checkRateLimit` reports which backend served a given
 *   check via the `backend` field so callers/logs can tell the difference.
 */

export interface RateLimitOptions {
  /** Max requests allowed inside one window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  /** Requests still permitted in the current window (0 once blocked). */
  remaining: number;
  /** Unix ms timestamp when the current window resets. */
  resetAt: number;
  backend: 'upstash' | 'memory';
}

interface MemoryBucket {
  count: number;
  resetAt: number;
}

const memoryStore = new Map<string, MemoryBucket>();

// Bounds unbounded growth from a flood of distinct keys (e.g. spoofed
// X-Forwarded-For values) - once past this size, expired entries are swept
// before inserting a new one. A real attack generating millions of distinct
// keys is itself rate-limited by the same check using its own key, so this
// is a memory backstop, not the primary defense.
const MAX_MEMORY_ENTRIES = 50_000;

function sweepExpired(now: number) {
  for (const [key, bucket] of memoryStore) {
    if (bucket.resetAt <= now) memoryStore.delete(key);
  }
}

function checkInMemory(key: string, opts: RateLimitOptions, now: number): RateLimitResult {
  if (memoryStore.size > MAX_MEMORY_ENTRIES) sweepExpired(now);

  let bucket = memoryStore.get(key);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + opts.windowMs };
    memoryStore.set(key, bucket);
  }

  bucket.count += 1;
  const allowed = bucket.count <= opts.limit;
  return {
    allowed,
    limit: opts.limit,
    remaining: Math.max(0, opts.limit - bucket.count),
    resetAt: bucket.resetAt,
    backend: 'memory',
  };
}

function upstashConfig(): { url: string; token: string } | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return { url, token };
}

/**
 * INCR the window's counter and set its expiry in one round trip via
 * Upstash's REST pipeline endpoint, keyed so every window gets a fresh
 * Redis key (`rl:{key}:{windowIndex}`) rather than resetting a shared
 * counter - avoids a race between "read count" and "reset if expired"
 * that a plain INCR+TTL-if-absent would otherwise need a Lua script for.
 */
async function checkWithUpstash(
  key: string,
  opts: RateLimitOptions,
  now: number,
  config: { url: string; token: string },
): Promise<RateLimitResult> {
  const windowIndex = Math.floor(now / opts.windowMs);
  const resetAt = (windowIndex + 1) * opts.windowMs;
  const redisKey = `rl:${key}:${windowIndex}`;
  const windowSeconds = Math.max(1, Math.ceil(opts.windowMs / 1000));

  const response = await fetch(`${config.url}/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify([
      ['INCR', redisKey],
      ['EXPIRE', redisKey, windowSeconds],
    ]),
  });

  if (!response.ok) {
    throw new Error(`Upstash rate-limit request failed: ${response.status}`);
  }

  const results = (await response.json()) as Array<{ result: number }>;
  const count = results[0]?.result ?? 0;
  const allowed = count <= opts.limit;

  return {
    allowed,
    limit: opts.limit,
    remaining: Math.max(0, opts.limit - count),
    resetAt,
    backend: 'upstash',
  };
}

/**
 * Checks and increments the rate-limit counter for `key` (typically
 * `ip:<addr>` or `uid:<firebase-uid>`). Fails open on an Upstash error
 * (network blip, misconfigured token) by falling back to the in-memory
 * backend for that single check - a rate limiter that itself takes the
 * app down on a transient Redis error is worse than best-effort limiting.
 */
export async function checkRateLimit(
  key: string,
  opts: RateLimitOptions,
): Promise<RateLimitResult> {
  const now = Date.now();
  const config = upstashConfig();
  if (config) {
    try {
      return await checkWithUpstash(key, opts, now, config);
    } catch (err) {
      console.error('Rate limit: Upstash check failed, falling back to in-memory.', err);
    }
  }
  return checkInMemory(key, opts, now);
}

/** Test-only: clears the in-memory backend's state between test cases. */
export function __resetMemoryRateLimitStore() {
  memoryStore.clear();
}
