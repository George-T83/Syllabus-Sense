# Combined findings summary

Covers everything learned across this project's work so far: the Phase 1 triage of `main`, a mobile and desktop UX pass, and the reports of each background worker (calendar feed, sample semester, test coverage, accessibility audit, Degree Compass planner). Each finding says how it was established. The prioritised, actionable version is in `backlog.md`; the item numbers (B-nn) refer to it.

Compiled October 24, 2026 against `main` at `a007f76`.

## 1. State of `main`

| Check                                               | Result                                                                                                                                                               | How established                                                      |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| CI                                                  | Red, on one step: "Check for Critical Dependency Vulnerabilities". Lint, build, unit tests, rules tests and the end-to-end job pass.                                 | GitHub Actions run on `a007f76`; the audit script reproduced locally |
| Cause of the red                                    | Two new critical advisories: `dompurify` (<=3.4.16) and `next` (9.3.4-canary.0 to 16.3.0-preview.10). Both have fixes per `npm audit` (`next` 15.5.28 is non-major). | Local `npm audit --omit=dev` and the audit script (B-01)             |
| Type check and lint                                 | Clean                                                                                                                                                                | Run locally                                                          |
| Production dependency audit (besides the two above) | 6 high, 6 moderate remain, all needing major upgrades                                                                                                                | `npm audit --omit=dev` (B-31)                                        |
| Open pull requests                                  | #321 (privacy page, on hold) and #337 (end-to-end test for the calendar feed, CI green)                                                                              | GitHub                                                               |

## 2. Live UX pass

Run on the Firebase emulators in a real browser, with a seeded student.

- **13 routes at 1280px and 390px:** no horizontal overflow, no unnamed buttons or links, no unlabelled inputs, no skipped headings, no page errors. The only console warning is Firestore's "Listen" stream warning on the dashboard. The tap-target counter now reports only the heatmap squares and a few card links (the skip link it also lists is intentionally off screen).
- **8 routes at 390px in light and dark:** the dark theme is coherent and nothing overflows. Main has 144px of bottom padding and a bottom navigation bar.
- **Defect found, and a correction to my first triage.** I had said the floating Focus Timer and AI Advisor buttons "cover content on every phone screen". That overstated it: the end of a page scrolls clear of them. What is true is that on the Advisor page at 390px the two buttons sit over the question box and send button, and the AI Advisor button is shown on the Advisor page itself. They also cover text mid-scroll on the course page and the calendar (B-16).
- **Other defects:** task page flashes "This task doesn't exist" after a delete before redirecting (B-18); 18 `hover:scale` uses against the lift design bar (B-17); estimated-effort spacing on the task page (B-22); long task titles truncate on phones when two pills are present (B-21).
- **Not covered:** modals, the autofill review screen, the grade calculator, and dark mode on every state (B-23).

## 3. Product gaps found in the code

- Profile Notifications is entirely disabled "Coming soon" toggles, plus a "Canvas sync" row (B-05).
- The AI usage cap is switched off (B-03).
- No privacy or AI disclosure exists on `main`; it is in #321 (B-02).
- A development-only fake sign-in path with a hard-coded user id is still in `AuthContext` and `useFirestoreSync`, guarded off in production (B-15).
- The headline flow (upload, extract, review) and the 3MB to 10MB Storage path have not been run against the live AI provider or the host's real request limit (B-04).

## 4. Reports from each background worker

**Calendar feed worker (#325, merged).** The existing ICS generator was already shared and pure, so it was reused. Decisions it surfaced: the feed includes the instructor and task notes; links never expire until reset or turned off; no `webcal://` link or calendar name (B-07). It could not run the emulators in its own sandbox, so the first real run was mine: create, fetch, unknown token 404, reset makes the old link 404, all passing; later made permanent in #337.

**Sample semester worker (#324, merged).** Decisions it surfaced: removing sample data deletes the sample courses wholesale including anything added to them (B-11); sample records are excluded from AI requests on the client only (B-10). My live run found a third issue it had not: the setup checklist counts sample data as done (B-09).

**Test coverage worker (#330, merged).** 149 new tests across the Advisor, quizzes, mood, sign-in and landing page, product code untouched. Six product issues found, now resolved or recorded:

| Finding                                              | Outcome                                                                                                   |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Sign-in and sign-up errors silent to screen readers  | Fixed in #333                                                                                             |
| Sign-up had no password-length check of its own      | Fixed in #333 (the correct sentence was already shown from the server; the misleading part was the toast) |
| Regenerating a quiz deleted the old one first        | Fixed in #332                                                                                             |
| A quiz score could be shown as saved when it was not | Fixed in #332                                                                                             |
| Mood recap's empty state used a full page load       | Fixed in #336                                                                                             |
| Test config excludes `.claude` folders               | Harmless; no action                                                                                       |

**Accessibility audit worker (#331, merged).** The originally listed colour token pairs already passed; four tinted pairs at 4.42 to 4.48:1 were raised to 4.60 to 4.95:1. Added a permanent contrast test over about 55 pairs in both themes, a skip link, main landmarks and top-level headings on the sign-in pages. Its axe run (in a mock sign-in mode, not on the emulators) went from 3 violations each on `/login` and `/signup` to none on eight routes. Left out on purpose: text at partial opacity, text over gradients, and input and card borders (about 1.3:1) (B-20); several pages and all modals were not re-run (B-24). I verified the skip link and CI myself; I did not re-run its axe numbers.

**Degree Compass worker (#328, merged).** Credits-only "what if" planner. Decisions it surfaced: hypothetical courses count as completed; the planner knows nothing of prerequisites or offerings; it is on the Path view only (B-13). It never opened a browser; my live pass found no page errors.

## 5. Defects found along the way, and their status

| Defect                                                                                               | Found by                                        | Status                                                             |
| ---------------------------------------------------------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------ |
| Admin Storage bucket missing when the Firestore admin loads first, so stored-file routes could throw | A live run of a new route; reproduced in a test | Fixed in #322. Whether production was affected is unchecked (B-27) |
| "Before" screenshot in the calendar feed review document was taken on the PR branch                  | My own review                                   | Corrected                                                          |
| Description of sign-up's short-password behaviour was wrong                                          | Live before/after capture                       | Corrected in the PR text and doc                                   |
| Floating-buttons overlap overstated                                                                  | The UX pass above                               | Corrected here and in the backlog                                  |

## 6. What was verified, and what was not

Verified by me in a real browser against the emulators, at desktop width: Undo, the sample semester, the calendar feed, task steps and the steps pill, the Degree Compass planner, uploads through Storage (against a local stand-in for the AI provider), and the sign-in error announcements; plus mobile and tablet screenshots for the PRs that changed the interface. The dependency clean-up, the extraction repair and the test additions were verified by unit tests and CI only. Verified in CI: tests, lint, build, rules tests and the end-to-end job on each PR.

Not verified: anything against the live AI provider; the host's real 4.5MB request limit; a real calendar app subscribing to the feed; dark mode for every state; modals; production logs.

## 6b. Process

Background workers were used for the larger independent pieces (calendar feed, sample semester, test coverage, accessibility audit, Degree Compass planner). In this redirection phase no workers were used; the backlog, this summary and the UX pass were done in one session to save usage.
