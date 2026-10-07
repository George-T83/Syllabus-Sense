# Operations

What runs where, and what to do when it breaks.

## Environments

One Firebase project serves every environment, separated by Firestore database:

| Environment      | Firestore database                     |
| ---------------- | -------------------------------------- |
| Production       | `(default)`                            |
| Preview, staging | `staging`                              |
| Local            | `staging`, or the Local Emulator Suite |

The app is hosted on Vercel. Every PR gets a preview deployment.

## Environment variables

Listed with their purpose in `.env.example`. The ones that matter most:

- `NEXT_PUBLIC_FIREBASE_*` configure the browser client. `NEXT_PUBLIC_USE_FIREBASE_EMULATOR=true` points it at the local emulators.
- `FIREBASE_ADMIN_PROJECT_ID` (plus the client email and private key outside the emulators) lets API routes verify tokens. If the project id is missing, the AI routes answer 401 instead of running anonymously.
- `ANTHROPIC_API_KEY` and the `*_MODEL` variables select the AI provider and models.
- `AI_DAILY_CALL_LIMIT`, `AI_UNLIMITED_UIDS`, `AI_UNLIMITED_EMAILS` tune the per-user AI cap (`docs/AI_USAGE_CAP.md`).

## CI

`.github/workflows/ci.yml` runs on every PR and is the required check, "Lint, Build, and Test". In order: commit-message attribution check, lint, build, unit tests, Firestore and Storage rules tests (against the emulators), and a critical dependency audit.

### The dependency audit

`scripts/check-critical-audit.mjs` fails the build on any critical `npm audit` finding. When one appears:

1. Update or override the package to a fixed version. This is almost always possible (for example `overrides` in `package.json`).
2. Only if no fix exists, add a waiver to `scripts/acceptedCriticalVulnerabilities.json` with a reason and an `expires` date at most 90 days out. An expired waiver fails the build again on purpose.

A critical finding in a dev-only tool still fails CI, so it is not a reason to ignore it.

## Firestore rules and indexes

`.github/workflows/deploy-firestore-rules.yml` deploys `firestore.rules` and `firestore.indexes.json` to the live project when a change to either lands on `main`. Nothing deploys `storage.rules` automatically, so deploy that by hand when it changes.

## Commits

Commit messages are checked for AI attribution by a `commit-msg` hook and again in CI. See `CLAUDE.md` for the repository's rules on commits and merging.

## When something is wrong in production

- A page that works locally but denies reads in production usually means rules are not deployed. Check the deploy workflow ran for the last change to `firestore.rules`.
- A spike in AI cost: set `AI_DAILY_CALL_LIMIT` and turn the cap on (`docs/AI_USAGE_CAP.md`), and check the provider's own spend limit.
- To roll back a bad release, promote the previous deployment in Vercel. Firestore data is not rolled back by that.
