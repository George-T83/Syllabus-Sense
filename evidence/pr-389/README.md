# Evidence for PR #389 — Archive or delete a course, with one-tap Restore

Captured against the Firebase Local Emulator Suite and a live browser (Playwright, Chromium) at 1280px and 390px, light and dark. The dev-only emulator banner and the floating Focus Timer / AI Advisor pills are hidden in the captures with injected CSS.

## Before
Deleting a course showed an inline Confirm / Cancel and the only outcome was permanent deletion.

- `before-delete-prompt-{1280,390}-{light,dark}.png`

## After
- `after-delete-prompt-*.png` — the confirmation: Archive (default focus, keeps everything) and Delete forever, plus Cancel.
- `after-archived-list-*.png` — Courses page with the new Archived section (one-tap Restore, Delete forever with its own confirmation).
- `after-archived-course-page-*.png` — opening an archived course shows a notice with Restore course instead of "Course not found".
- `after-restored-list-*.png` — after Restore the course is back in the active list.

## Behavior log
See `behavior-before.txt` and `behavior-after.txt` (read from the emulator: archivedAt set/cleared, tasks kept, dashboard exclusion, Delete forever cascade).

## Verification
See `full-suite-PASSING.log`.
