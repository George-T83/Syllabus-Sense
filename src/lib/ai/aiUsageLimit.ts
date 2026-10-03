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

/**
 * Hard ceiling on Anthropic-calling requests across ALL accounts (and any
 * unauthenticated caller) per UTC day. Unlike the per-user cap below, which
 * the repo owner turned off, this one bounds the worst-case daily bill no
 * matter how many accounts or scripts are calling. Tune with
 * AI_GLOBAL_DAILY_CALL_LIMIT; see docs/AI_USAGE_CAP.md for how to pick it.
 */
export const AI_GLOBAL_DAILY_CALL_LIMIT = (() => {
  const raw = Number(process.env.AI_GLOBAL_DAILY_CALL_LIMIT);
  return Number.isInteger(raw) && raw > 0 ? raw : 1000;
})();

/**
 * Global kill switch for the cap below - turned off deliberately by the
 * repo owner. See docs/AI_USAGE_CAP.md for why, and for what to check before
 * flipping this back to `true` (which is the only change re-enabling it
 * needs - the limit/allowlist logic underneath is untouched).
 */
export const AI_USAGE_CAP_ENABLED = false;

export interface AiUsageCaller {
  uid: string;
  email?: string;
}

export type AiUsageDenialReason = 'user_limit' | 'global_limit';

export interface AiUsageDecision {
  allowed: boolean;
  remaining: number;
  limit: number;
  /** Why a call was refused. Absent when `allowed` is true. */
  reason?: AiUsageDenialReason;
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
 * Pure decision for one call. The global budget is checked first so a refused
 * call never uses up a per-user slot, and a per-user refusal never uses up a
 * global one. `userCount` is null when the caller is not metered per user
 * (cap switched off, exempt account, or no identity).
 */
export function decideAiCall(input: {
  globalCount: number;
  globalLimit?: number;
  userCount: number | null;
  userLimit?: number;
}): { allowed: boolean; reason?: AiUsageDenialReason; userRemaining: number | null } {
  const globalLimit = input.globalLimit ?? AI_GLOBAL_DAILY_CALL_LIMIT;
  const userLimit = input.userLimit ?? AI_DAILY_CALL_LIMIT;
  if (input.globalCount >= globalLimit) {
    return { allowed: false, reason: 'global_limit', userRemaining: null };
  }
  if (input.userCount === null) return { allowed: true, userRemaining: null };
  const user = decideAiUsage(input.userCount, userLimit);
  if (!user.allowed) return { allowed: false, reason: 'user_limit', userRemaining: 0 };
  return { allowed: true, userRemaining: user.remaining };
}

const UNLIMITED: AiUsageDecision = {
  allowed: true,
  remaining: Infinity,
  limit: Infinity,
  unlimited: true,
};

/**
 * Atomically checks and increments today's AI-call counts: the global budget
 * for every call, plus the per-user count for a metered caller. Returns
 * `allowed: false` (without incrementing anything) once either limit is hit.
 *
 * While `AI_USAGE_CAP_ENABLED` is off (see above) or the caller is exempt,
 * only the global budget applies. `caller` is null for an unauthenticated
 * request, which is also counted against the global budget.
 *
 * When adminDb isn't configured (local dev without admin credentials) this
 * fails open - the routes it guards already 503 without adminStorage/
 * getAnthropicClient in that case, so this is never the only gate. If the
 * transaction itself fails, the error propagates and the route returns 500
 * without calling Anthropic, so a Firestore outage stops spend rather than
 * allowing it.
 */
export async function checkAndIncrementAiUsage(
  caller: AiUsageCaller | null,
): Promise<AiUsageDecision> {
  const userMetered = caller !== null && AI_USAGE_CAP_ENABLED && !isExempt(caller);

  if (!adminDb) {
    return userMetered
      ? {
          allowed: true,
          remaining: AI_DAILY_CALL_LIMIT - 1,
          limit: AI_DAILY_CALL_LIMIT,
          unlimited: false,
        }
      : UNLIMITED;
  }

  const now = new Date();
  // The budget resets at UTC midnight so "paused until midnight UTC" is a
  // single, server-independent moment.
  const globalRef = adminDb.doc(`aiBudget/${now.toISOString().slice(0, 10)}`);
  const userRef =
    userMetered && caller ? adminDb.doc(`users/${caller.uid}/aiUsage/${toDayKey(now)}`) : null;

  return adminDb.runTransaction(async (tx) => {
    const [globalSnap, userSnap] = await Promise.all([
      tx.get(globalRef),
      userRef ? tx.get(userRef) : Promise.resolve(null),
    ]);
    const globalCount = (globalSnap.exists ? (globalSnap.data()?.count as number) : 0) ?? 0;
    const userCount = userSnap
      ? ((userSnap.exists ? (userSnap.data()?.count as number | undefined) : 0) ?? 0)
      : null;

    const decision = decideAiCall({ globalCount, userCount });
    if (!decision.allowed) {
      const reason = decision.reason as AiUsageDenialReason;
      return reason === 'global_limit'
        ? {
            allowed: false,
            remaining: 0,
            limit: AI_GLOBAL_DAILY_CALL_LIMIT,
            unlimited: !userMetered,
            reason,
          }
        : { allowed: false, remaining: 0, limit: AI_DAILY_CALL_LIMIT, unlimited: false, reason };
    }

    const stamp = new Date().toISOString();
    tx.set(globalRef, { count: globalCount + 1, updatedAt: stamp }, { merge: true });
    if (userRef && userCount !== null) {
      tx.set(userRef, { count: userCount + 1, updatedAt: stamp }, { merge: true });
    }
    return decision.userRemaining === null
      ? UNLIMITED
      : {
          allowed: true,
          remaining: decision.userRemaining,
          limit: AI_DAILY_CALL_LIMIT,
          unlimited: false,
        };
  });
}
