/**
 * A small per-key sliding-window limiter held in server memory.
 *
 * It protects routes that do real work per call but are not metered (the
 * plain-text extraction route parses up to 10 MB of PDF or Word on every
 * request). It is deliberately best-effort: on a serverless host each warm
 * instance keeps its own counts, so the ceiling is per instance, which is
 * still enough to stop a single account from hammering one route in a loop.
 */
export interface RateLimitDecision {
  allowed: boolean;
  /** Seconds until the oldest counted call falls out of the window. */
  retryAfterSeconds: number;
}

export function createRateLimiter(limit: number, windowMs: number, maxKeys = 5000) {
  const hits = new Map<string, number[]>();

  return function check(key: string, now: number = Date.now()): RateLimitDecision {
    const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
    if (recent.length >= limit) {
      hits.set(key, recent);
      return { allowed: false, retryAfterSeconds: Math.ceil((recent[0] + windowMs - now) / 1000) };
    }
    recent.push(now);
    // Re-insert so the Map's order tracks recency, then trim the oldest keys.
    hits.delete(key);
    hits.set(key, recent);
    while (hits.size > maxKeys) {
      const oldest = hits.keys().next().value;
      if (oldest === undefined) break;
      hits.delete(oldest);
    }
    return { allowed: true, retryAfterSeconds: 0 };
  };
}
