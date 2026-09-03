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

## Merge approval

Never merge a PR without the repo owner's explicit go-ahead in the conversation, even when CI is green and the branch is mergeable. "Drive this PR to green" is not the same instruction as "merge it" — green CI is a precondition for asking, not a substitute for asking. Before requesting merge approval on any non-trivial change, produce a short review write-up (what changed, why, and evidence — screenshots against the real app for anything touching the UI) so the owner can review it the way a lead would review a teammate's PR, not just rubber-stamp a green check mark.

## UI consistency

Before adding or changing any "list card" pattern (a card with a header action button, an empty state, and a row-level edit/delete affordance — e.g. Contacts, Learning Objectives, Tasks on the course detail page), check how the other instances of that same pattern already look and match them exactly: same header button component (`CardActionButton`), same empty-state component (`EmptyState`), same button treatment for row-level actions (pill-style with a tinted background for primary/destructive actions, not a bare underlined text link). Do not invent a new one-off treatment for a single card — if an existing shared component already covers the need, use it. When two nearly-identical UI patterns exist in the same file, that is a bug worth fixing on sight, not something to leave for a later audit.
