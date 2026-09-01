import { NextRequest, NextResponse } from 'next/server';
import type { RateLimitOptions, RateLimitResult } from './rateLimit';

/**
 * Best-effort client identity for rate-limit keys. Vercel sets
 * `x-forwarded-for` to `client, proxy1, proxy2, ...` - the first entry is
 * the original client. Not spoof-proof (a client can send its own
 * `x-forwarded-for`), but Vercel's edge network overwrites this header
 * rather than appending to a client-supplied one, so on Vercel it's
 * trustworthy; the `'unknown'` fallback keeps every request with no header
 * present (e.g. local `next dev`) sharing one bucket instead of bypassing
 * the limit entirely.
 */
export function getClientIp(req: NextRequest): string {
  const forwardedFor = req.headers.get('x-forwarded-for');
  if (forwardedFor) {
    const first = forwardedFor.split(',')[0]?.trim();
    if (first) return first;
  }
  return req.headers.get('x-real-ip') || 'unknown';
}

function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
  };
}

/**
 * Runs a rate-limit check for `key` and returns a ready-to-return 429
 * response when the caller is over budget, or `null` when the request
 * should proceed. Callers attach the same rate-limit headers to their own
 * success response via `rateLimitHeaders(result)` so a client can see its
 * remaining budget even on a 200.
 *
 * ```ts
 * const ip = getClientIp(req);
 * const limitResult = await checkRateLimit(`ip:${ip}`, { limit: 5, windowMs: 10 * 60_000 });
 * const blocked = rateLimitedResponse(limitResult);
 * if (blocked) return blocked;
 * ```
 */
export function rateLimitedResponse(result: RateLimitResult): NextResponse | null {
  if (result.allowed) return null;

  const retryAfterSeconds = Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000));
  return NextResponse.json(
    { error: 'Too many requests. Please slow down and try again shortly.' },
    {
      status: 429,
      headers: {
        ...rateLimitHeaders(result),
        'Retry-After': String(retryAfterSeconds),
      },
    },
  );
}

export { rateLimitHeaders };
export type { RateLimitOptions };
