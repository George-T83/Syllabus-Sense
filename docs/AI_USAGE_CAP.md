# AI usage cap: currently disabled

**Status:** Disabled (`AI_USAGE_CAP_ENABLED = false` in `src/lib/ai/aiUsageLimit.ts`)
**Decision by:** repo owner, direct instruction
**Date:** 2026-09-24

## What this is

`src/lib/ai/aiUsageLimit.ts` enforces a per-user daily call cap (default 60/day,
`AI_DAILY_CALL_LIMIT` env var to tune it) across every Anthropic-calling route:
syllabus extract/summarize/chat, cram-plan, flashcards, quiz generation, and
the Advisor chat. It was added to close a real gap found in an earlier audit —
without it, a compromised token, a buggy retry loop, or a rapid clicker had no
ceiling on API cost.

It also has a standing exemption path: `AI_UNLIMITED_UIDS` /
`AI_UNLIMITED_EMAILS` (comma-separated, env-configured) let specific accounts
bypass the cap entirely — meant for a founder/admin account testing AI
features without hitting a student-sized quota.

## What changed

The repo owner asked to turn the cap off. Rather than remove the guardrail
code, `AI_USAGE_CAP_ENABLED` is a single boolean kill switch at the top of
`aiUsageLimit.ts`: while it's `false`, `checkAndIncrementAiUsage` returns
`unlimited: true` for every caller unconditionally, before the allowlist or
Firestore are ever touched. The limit constant, the allowlist parsing, and
`decideAiUsage` (the pure per-call decision logic) are all untouched and still
unit-tested — re-enabling the cap is a one-line flip back to `true`, not a
rebuild.

## Why this matters / what to check before re-enabling

This is a genuine, deliberate reduction in cost protection, not a no-op. With
it off:

- There is no ceiling on how many Anthropic API calls a single account (or a
  script hitting these routes with a stolen/leaked token) can make in a day.
- The only remaining backstops are whatever Anthropic-side rate limits or
  spend alerts exist on the account's own API key — nothing in this app
  enforces a per-user limit anymore.

Before flipping `AI_USAGE_CAP_ENABLED` back to `true`, or before leaving it
off for an extended period in production, worth checking:

- Anthropic console spend alerts / hard spend limits are configured on the
  API key this app uses, if this hasn't been confirmed already.
- Whether the original trigger for this cap (see the audit history around
  PR #239, "unbounded AI usage / no cost caps") has otherwise been addressed
  a different way.

## How to re-enable

In `src/lib/ai/aiUsageLimit.ts`, change:

```ts
export const AI_USAGE_CAP_ENABLED = false;
```

back to `true`. Nothing else needs to change — the limit, the allowlist, and
the Firestore-backed daily counter all still work exactly as before.
