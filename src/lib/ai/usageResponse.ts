import { NextResponse } from 'next/server';
import type { AiUsageDecision } from '@/lib/ai/aiUsageLimit';

/** Seconds until the next UTC midnight, when the daily budget resets. */
export function secondsUntilUtcMidnight(now: Date = new Date()): number {
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  return Math.max(1, Math.ceil((next - now.getTime()) / 1000));
}

/**
 * The response for a refused AI call. A per-user refusal is a 429 as before.
 * A global-budget refusal is a 503 with Retry-After: the service is
 * deliberately paused, and it is not this caller's quota.
 */
export function aiUsageDeniedResponse(usage: AiUsageDecision, now: Date = new Date()) {
  if (usage.reason === 'global_limit') {
    return NextResponse.json(
      {
        error:
          'AI features are paused for the rest of today to keep costs in check. They come back at midnight UTC.',
        code: 'ai_budget_exhausted',
      },
      { status: 503, headers: { 'Retry-After': String(secondsUntilUtcMidnight(now)) } },
    );
  }
  return NextResponse.json(
    { error: `Daily AI usage limit reached (${usage.limit} requests/day). Try again tomorrow.` },
    { status: 429 },
  );
}
