# Evidence for PR #392 — cut required Actions minutes per PR

Billed minutes below are each job's runner time rounded up to a whole minute, which is how a private repo is metered. Numbers come from real runs on this repo; the raw per-job and per-step timings are in this directory.

## Per-run cost (one push to a PR)

| Scenario | Before | After |
|---|---|---|
| Typical code PR: Lint, Build, and Test | 283 s, 5 min | 198 s, 4 min |
| Typical code PR: End-to-end smoke | 131 s, 3 min | 80 s, 2 min |
| **Typical code PR, total** | **8 min** | **6 min (-25%)** |
| Prose-only PR (README, docs/) | 8 min | **2 min (-75%)**, both checks still report green |
| Strip PR Attribution, per PR | 2 runs, 2 min | 0 runs on a clean body, 1 short run when a footer has to be removed |
| Push to main (each merge) | 8 min (both jobs) | about 5 min (estimated from the measured steps plus the audit): Lint, Build, and Test only |
| Superseded push | runs to the end | cancelled when the next push lands |

The "before" side is the average of the last 30 green PR runs: 4.83 min for Lint, Build, and Test, 3.03 min for e2e, 7.87 min total per run (`baseline-runs.tsv`, `baseline-summary.txt`). The two workflow-run records compared step by step are in `before-run.txt` and `after-runs.txt`.

Over a PR that is pushed once and merged (PR run + strip + main run): about 18 min before, about 12 min after (main-run figure estimated). With a second push: 26 before, 18 after. Cancelled superseded runs save more on top.

## Where the time went

| Step (Lint, Build, and Test) | Before | After |
|---|---|---|
| Install dependencies | 77 s | 0 s on a cache hit (6 s restore) |
| Build | 59 s | 46 s (restored Next build cache) |
| Critical dependency audit | 4 s (after an install that already paid about a minute for it) | skipped unless dependency files changed |
| Unit tests, rules tests, lint | 101 s, 17 s, 8 s | unchanged: the quality gates are not trimmed |

In e2e: install 45 s -> restored, browser install 24 s -> 9 s with the browser cache. A finding worth noting: `npm ci`'s built-in audit was costing about a minute inside the install step. Moving to a restored `node_modules` exposed the standalone `npm audit` step as the real ~55-60 s cost (`npm audit` fetches package metadata for every vulnerable package), which is why it is now run on dependency changes, on main, and nightly rather than on every push.

## Required check

`Lint, Build, and Test` is unchanged in name and still reports on every PR and every push to main. On a prose-only PR it finishes in seconds with the heavy steps skipped (`after-runs.txt`; on the scratch PR its check-run concluded `success`). It still runs the commit-attribution check on every PR. The job fails closed: if the scope step errors, the job fails, and any unexpected state runs everything.

## How the skipped-PR and cache cases were demonstrated

A prose-only PR cannot be shown directly before this change is on main, because the change itself edits workflow files (which always run everything). Two scratch PRs (#390 and #391, closed unmerged) carried the same workflow with only the scope allowlist widened so a README-only diff was visible. #390 mimicked a typical code PR (run 41207738508); #391 a prose-only PR (run 41207743206). Run history on #390 also shows cancel-in-progress working: runs 41207301700 and 41207324071 were cancelled by newer pushes.

## Tests

`scripts/__tests__/ciScope.test.ts`: prose-only detection, audit-input detection, fail-safe on empty input, and a guard that the strip workflow's cheap pre-filter is a superset of everything `stripAiAttribution` removes. Full output in `tests.log`.
