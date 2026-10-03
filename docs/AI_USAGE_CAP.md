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

---

## Global daily budget (always on)

The per-user cap above is off by the owner's decision and is left as it was.
Separately, every Anthropic-calling route now also counts against one shared
**global daily budget**, so the worst-case daily bill is bounded no matter how
many accounts, scripts or unauthenticated callers are hitting the routes.

- **Limit:** `AI_GLOBAL_DAILY_CALL_LIMIT` (positive integer). Default **1000**
  calls per UTC day. This number is a policy choice, not a measurement:
  multiply it by the most a single call can cost (a full syllabus extraction is
  the largest) to get the daily ceiling, and set it where that figure is
  acceptable.
- **Counter:** one Firestore document per UTC day, `aiBudget/{YYYY-MM-DD}`,
  incremented in the same transaction as the check. Only the server (Admin SDK)
  can read or write it; `firestore.rules` denies every client.
- **When it runs out:** the routes answer `503` with `Retry-After` (seconds to
  UTC midnight) and `{ code: "ai_budget_exhausted" }`. A refused call is not
  counted, and nothing is sent to Anthropic.
- **Who counts:** everyone, including accounts on `AI_UNLIMITED_UIDS` /
  `AI_UNLIMITED_EMAILS` and unauthenticated demo/dev callers.
- **Failure mode:** if the budget transaction itself fails, the route returns
  500 and makes no AI call (it fails closed). With no admin credentials at all
  (local dev) the check is skipped, as before.

### Trade-off to know about

A global limit protects the bill, not availability. While the per-user cap is
off, one account can use up the whole day's budget and pause AI features for
everyone until midnight UTC. If that matters, turn the per-user cap back on
(see "How to re-enable") with a limit well below the global one.

The counter is a single document, which Firestore handles at roughly one
write per second sustained. That is ample at this app's scale; at much higher
volume it would need to be sharded.

### Request body limits

Every AI route now reads its JSON body through `readJsonBody`, which refuses
an oversized body (`413`) from the `Content-Length` header or, for a chunked
body, as soon as the stream passes the limit, without buffering the rest:

| Route kind                                                           | Limit          |
| -------------------------------------------------------------------- | -------------- |
| Takes a base64 file (`extract`, `extract-text`, `chat`)              | about 14.25 MB |
| Chat-style (`advisor/chat`, `refine-draft`)                          | 256 KB         |
| Names a stored file (`summarize`, `quiz`, `flashcards`, `cram-plan`) | 16 KB          |

### Not something code can do: the provider-side limit

Set a **monthly spend limit and alerts on the Anthropic API key** this app
uses, in the Anthropic console. It is the only backstop that does not depend on
this app being correct, and the global budget above is not a substitute for it.
