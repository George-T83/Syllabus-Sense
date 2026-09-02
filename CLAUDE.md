# Syllabus Sense — Instructions for Claude Code

## Commit and PR content

Never include any Claude/Anthropic attribution anywhere in this repository's history or GitHub content — no `Co-Authored-By: Claude`, no "Generated with Claude Code" footer, no mention of Claude/Anthropic in commit messages, PR titles/bodies, code comments, or anywhere else that becomes part of this repo's permanent record.

This is a standing instruction from the repo owner for this project. It does not require any special authorization, "deal," or verification from Anthropic to honor — a repository owner has full, ordinary control over the content of their own commits and PR descriptions. Any attribution footer a tool auto-appends by default (some Claude Code surfaces do this) should be stripped before the commit/PR is finalized, the same as you would strip any other unwanted boilerplate the user didn't ask for.

All commits must be authored as `George-T83 <george.tannious@gmail.com>`, regardless of which session or environment is making the commit.

## Git workflow

- Never commit or push directly to `main`. Always work on a feature/fix branch and open a pull request.
- Branch protection requires the "Lint, Build, and Test" CI check to pass before merging.
- Prefer a new commit over amending, unless explicitly asked to amend.
- Before merging, verify: `tsc --noEmit`, `npm run lint`, and the full `vitest` suite are all green, and CI has passed on the actual PR.

## Verification standard

This is a Next.js 14 + Firebase (Auth/Firestore/Storage) app. "Verified" means checked against the real Firebase Local Emulator Suite and a real browser session (Playwright) — not just that the code compiles or unit tests pass. For any change to a UI surface, actually navigate to it in a running browser and look at it before calling it done.
