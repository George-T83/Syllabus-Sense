import { adminDb } from '@/lib/firebase/adminFirestore';
import { toDayKey } from '@/lib/calendar/dates';

/**
 * A single account previously had no ceiling on Anthropic-calling routes
 * (extract, summarize, chat, cram-plan, flashcards, quiz) - a compromised
 * token, a buggy retry loop, or just a rapid clicker could run up unbounded
 * API cost. This is a deliberately simple per-user daily call counter, not
 * a cost-weighted budget: every AI call counts once regardless of route,
 * which is a coarser signal than metering actual token/dollar cost but is
 * enough to put a hard ceiling on the worst case, and is trivial to reason
 * about and test. Override via AI_DAILY_CALL_LIMIT for local tuning.
 */
export const AI_DAILY_CALL_LIMIT = (() => {
  const raw = Number(process.env.AI_DAILY_CALL_LIMIT);
  return Number.isFinite(raw) && raw > 0 ? raw : 60;
})();

export interface AiUsageCaller {
  uid: string;
  email?: string;
}

export interface AiUsageDecision {
  allowed: boolean;
  remaining: number;
  limit: number;
  /** True when this call bypassed the cap entirely (an exempt account) -
   * `remaining`/`limit` are meaningless in that case and callers shouldn't
   * display them as a real quota. */
  unlimited: boolean;
}

function parseAllowlist(raw: string | undefined): Set<string> {
  return new Set(
    (raw ?? '')
      .split(',')
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean),
  );
}

/**
 * There's no billing/paid-tier system yet, so "exempt from the daily cap"
 * is a deploy-time allowlist rather than a real upgrade path - a founder or
 * admin account that needs to test AI features without hitting a student
 * quota, configured via env var (comma-separated Firebase UIDs and/or
 * emails) rather than hardcoded here, since this file is committed to the
 * repo and account identifiers shouldn't be. Once real payment exists, this
 * is the seam a "paid, unlimited" plan would also hook into.
 */
function isExempt(caller: AiUsageCaller): boolean {
  const uids = parseAllowlist(process.env.AI_UNLIMITED_UIDS);
  if (uids.has(caller.uid.toLowerCase())) return true;

  const emails = parseAllowlist(process.env.AI_UNLIMITED_EMAILS);
  if (caller.email && emails.has(caller.email.toLowerCase())) return true;

  return false;
}

/** Pure decision logic, kept separate from the Firestore transaction so it
 * can be unit tested without mocking firebase-admin. */
export function decideAiUsage(
  currentCount: number,
  limit: number = AI_DAILY_CALL_LIMIT,
): Omit<AiUsageDecision, 'unlimited'> {
  if (currentCount >= limit) {
    return { allowed: false, remaining: 0, limit };
  }
  return { allowed: true, remaining: limit - currentCount - 1, limit };
}

/**
 * Atomically checks and increments today's AI-call count for a user.
 * Returns `allowed: false` (without incrementing) once the daily limit is
 * hit. An exempt caller (see `isExempt`) always passes without touching
 * Firestore. When adminDb isn't configured (local dev without admin
 * credentials), this fails open - the routes it guards already 503 without
 * adminStorage/getAnthropicClient in that case, so this never becomes the
 * only gate.
 */
export async function checkAndIncrementAiUsage(caller: AiUsageCaller): Promise<AiUsageDecision> {
  if (isExempt(caller)) {
    return { allowed: true, remaining: Infinity, limit: Infinity, unlimited: true };
  }

  if (!adminDb) {
    return {
      allowed: true,
      remaining: AI_DAILY_CALL_LIMIT - 1,
      limit: AI_DAILY_CALL_LIMIT,
      unlimited: false,
    };
  }

  const dayKey = toDayKey(new Date());
  const ref = adminDb.doc(`users/${caller.uid}/aiUsage/${dayKey}`);

  return adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const currentCount = (snap.exists ? (snap.data()?.count as number | undefined) : 0) ?? 0;
    const decision = decideAiUsage(currentCount);
    if (!decision.allowed) return { ...decision, unlimited: false };

    tx.set(ref, { count: currentCount + 1, updatedAt: new Date().toISOString() }, { merge: true });
    return { ...decision, unlimited: false };
  });
}
