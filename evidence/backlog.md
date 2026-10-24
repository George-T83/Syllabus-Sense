# Syllabus Sense: prototype-ready backlog

Compiled from the Phase 1 triage of `main` at `a007f76` (October 24, 2026), a live mobile and desktop UX pass, and the findings of every earlier piece of work in this project (see `findings-summary.md`). Nothing here was implemented as part of compiling it, except where marked **Done**.

**Effort key** (rough, one person): **S** under 2 hours, **M** 2 to 6 hours, **L** one to three days.
**Owner decision** means George has to choose before anyone builds it; the item records the question and what "done" looks like for each answer.
Every UI item below carries the repo rule that its PR needs before/after screenshots at 1280px and 390px, light and dark.

---

## P0: unblock main

### B-01. Critical dependency advisories fail CI on every branch

- **Evidence:** `node scripts/check-critical-audit.mjs` reports two new critical advisories not in `scripts/acceptedCriticalVulnerabilities.json`: `dompurify` (<=3.4.16) and `next` (9.3.4-canary.0 to 16.3.0-preview.10). `npm audit` says both have fixes: `dompurify` is fixable, and `next` has a non-major fix to 15.5.28. `dompurify` is used only in `src/lib/syllabus/sanitizeDocxHtml.ts`.
- **Acceptance criteria**
  1. `node scripts/check-critical-audit.mjs` exits 0 with no new entries in the accepted list. If an advisory truly has no fix, the entry has a written reason and an `expires` date.
  2. `npm run build`, `npm test`, lint and the end-to-end job pass.
  3. The Word-document extraction tests still pass (they exercise `dompurify`).
  4. The PR changes only `package.json` and the lockfile (plus the accepted list if unavoidable) and passes CI on its own.
- **Effort:** S. **Status:** authorised, queued behind these documents.

---

## P1: owner decisions (recorded, not implemented)

### B-02. No privacy or AI disclosure on `main`

- **Evidence:** the privacy page and the sign-up disclosure live only in PR #321, which is on hold. On `main`, a student is not told that syllabi are read by an AI service.
- **Decision for George:** where questions go (contact address), whether counsel reviews the wording, and when #321 is released. No Terms of Service page is in scope.
- **Acceptance criteria once released:** `/privacy` loads signed out with no redirect; sign-up, landing footer and Profile link to it; every statement is true to the code (the no-analytics test stays green); 390px and 1280px, light and dark, screenshots.
- **Effort:** S once decided (the work exists in #321).

### B-03. AI usage cap is off

- **Evidence:** `AI_USAGE_CAP_ENABLED = false` in `src/lib/ai/aiUsageLimit.ts`. Any signed-in user can make unlimited AI calls.
- **Decision for George:** the daily limit per student, whether limits differ per feature, and the wording shown at the limit.
- **Acceptance criteria once decided:** the flag is on; the limit is enforced server-side per user per day; the 429 copy tells the student when they can retry (existing failure copy is reused); a test covers hit, reset and the allowed path; `docs/AI_USAGE_CAP.md` states the numbers.
- **Effort:** S to M.

### B-04. The headline flow has never been proven against the live AI provider

- **Evidence:** upload, extraction and review have only run against a local stand-in for the provider (no key in the working environment). The 3MB-to-10MB path through Storage and the real host request limit are likewise unproven.
- **Decision for George:** provide a key and a set of real syllabi (a short PDF, a long scanned PDF near 10MB, a Word file, a deliberately bad file), or run the smoke yourself.
- **Acceptance criteria:** a written run of upload, extract, review and save for each file; failures produce the documented messages (too long, busy, unreadable); the extraction notes for left-out items read correctly; results recorded in `evidence/`.
- **Effort:** M (needs the key).

### B-05. Notifications settings are dead UI

- **Evidence:** Profile, Notifications has disabled "Coming soon" toggles (daily digest email, deadline reminders, weekly recap) and a "Canvas sync: Coming soon" row (`src/components/profile/ProfileView.tsx`).
- **Decision for George:** hide for the prototype, or build a minimal in-app reminder.
- **Acceptance criteria if hidden:** no disabled toggles or "Coming soon" copy on Profile; no dead stored preferences read anywhere; screenshots. **If built:** see B-06.
- **Effort:** S (hide) or L (build).

### B-06. In-app deadline reminders (only if B-05 chooses to build)

- **Acceptance criteria:** a student can turn reminders on; a reminder appears in the bell for items due within the chosen window; nothing is emailed; the setting persists and is covered by tests and an end-to-end case.
- **Effort:** L.

### B-07. Calendar feed policy

- **Evidence:** the feed (#325, merged) includes the instructor and each task's notes, and a link never expires until reset or turned off.
- **Decision for George:** keep notes in or leave them out; add an expiry; add a `webcal://` link and a calendar name.
- **Acceptance criteria:** the chosen policy is reflected in the feed output and the Profile warning text; tests and the end-to-end feed case updated.
- **Effort:** S to M.

---

## P2: product gaps and logic

### B-08. Course deletion cascades with no Undo

- **Evidence:** Undo (#320) covers tasks and contacts. Deleting a course removes its tasks, contacts and materials together.
- **Acceptance criteria:** after confirming a course delete, an Undo restores the course, its tasks and its contacts with their original ids; survives a reload; the syllabus files are either kept for the Undo window or the copy says they are not restored; tests and an end-to-end case.
- **Effort:** M.

### B-09. Setup checklist counts sample data as real

- **Evidence:** with the sample semester loaded, "Get set up" reads 3 of 4 done.
- **Acceptance criteria:** the checklist ignores records marked `sample`; removing sample data returns it to the true state; unit test.
- **Effort:** S.

### B-10. Sample data exclusion from AI is client-side only

- **Evidence:** the Advisor and syllabus-chat requests omit sample courses on the client; the server routes do not know about the flag.
- **Acceptance criteria:** server routes reject or ignore any course or task marked `sample`; tests.
- **Effort:** S.

### B-11. Removing sample data deletes anything added to sample courses

- **Decision for George:** accept that behaviour (current), or keep the student's additions (leaves orphans).
- **Effort:** S once decided.

### B-12. Leftover files from interrupted large uploads

- **Evidence:** a file over 3MB goes to `users/{uid}/syllabi/_pending/` and is deleted by the server after it is read. If the tab closes mid-upload it stays until account deletion.
- **Acceptance criteria:** a scheduled cleanup removes `_pending` files older than a day; test for the age rule.
- **Effort:** M.

### B-13. Degree Compass planner is credits-only

- **Evidence:** "Try a plan" (#328) works in credits per requirement, not courses, prerequisites or offerings, and is on the Path view only.
- **Acceptance criteria for a v2:** specific-course entries, prerequisite warnings, the same card on the Ledger view; each its own PR.
- **Effort:** L (v2); the credits-only version is done.

### B-14. Steps on tasks are minimal

- **Evidence:** steps can be added, ticked and removed; the pill shows in lists (#334). No reorder, no rename, ticking the last step does not offer to complete the task.
- **Acceptance criteria:** rename a step; reorder by keyboard and pointer; when the last step is ticked, an inline "Mark task done?" prompt.
- **Effort:** M.

### B-15. Mock sign-in path ships in development builds

- **Evidence:** `AuthContext` and `useFirestoreSync` contain a development-only fake login with a hard-coded user id, guarded by `NODE_ENV !== 'production'`.
- **Acceptance criteria:** the code and its `mock_auth` references are removed; the production-bundle test still passes; end-to-end suite unaffected.
- **Effort:** S.

---

## P2: UI and UX

### B-16. Floating buttons overlap controls on phones

- **Corrected finding.** The app has bottom padding (144px on `main`) and a bottom navigation bar, so the end of a page can scroll clear. But the Focus Timer and AI Advisor buttons sit over controls above the fold: on the Advisor page at 390px they cover the question box and send button (and the AI Advisor button is shown on the Advisor page itself). They also cover text mid-scroll on the course page and calendar.
- **Acceptance criteria:** at 390px, light and dark, the Advisor question box and send button are fully visible and tappable; the AI Advisor button is hidden on `/advisor`; the buttons never cover a form control on any route; both stay dismissible and restorable from Profile; screenshots.
- **Effort:** S to M.

### B-17. Hover scale instead of lift

- **Evidence:** 18 uses of `hover:scale-*` or `active:scale-*`: the floating buttons, the auth and landing buttons, the empty-state button, the mood buttons, the heatmap cells and the colour swatches.
- **Acceptance criteria:** none of them scale on hover; each lifts with `translateY` plus a shadow instead; a lint or test guard fails if `hover:scale` is added; reduced-motion users get no movement.
- **Effort:** S to M.

### B-18. Task page flashes "This task doesn't exist" after delete

- **Evidence:** deleting from the task page shows "This task doesn't exist or has been removed" for a moment before the redirect to the task list (seen in the Undo screenshots).
- **Acceptance criteria:** no not-found state is rendered between the delete and the redirect; the Undo toast still appears on the list; end-to-end case.
- **Effort:** S.

### B-19. Small tap targets remain

- **Evidence:** the heatmap day squares (17px) on Tasks and Mood; the briefing row titles; the Appearance toggles keep their size with an extended hit area.
- **Acceptance criteria:** every interactive element is at least 36px in its tappable area at 390px, or has an enlarged hit area; the sweep script reports none except documented exceptions.
- **Effort:** S to M.

### B-20. Contrast gaps beyond solid token pairs

- **Evidence:** the contrast test (#331) covers token pairs. Text at partial opacity (for example muted text at 60 to 80%), text over gradients, and input and card borders (about 1.3:1) are outside it.
- **Decision for George** on borders (brand look versus 3:1).
- **Acceptance criteria:** partial-opacity text meets 4.5:1 on its real background; the test is extended to cover those combinations; borders per the decision.
- **Effort:** M.

### B-21. Phone titles truncate with two pills

- **Evidence:** at 390px a title with a weight pill and a steps pill shortens ("Researc…").
- **Acceptance criteria:** on narrow screens the pills wrap to the meta line, or the title wraps to two lines; screenshots.
- **Effort:** S.

### B-22. Estimated-effort field spacing on the task page

- **Evidence:** the number and "h" are separated by a wide gap ("10 h").
- **Effort:** S.

### B-23. Full dark-mode and modal audit not done

- **Evidence:** a 390px dark and light pass of eight routes found no overflow and a coherent dark theme, but modals, the autofill review screen, the grade calculator and flows with data in every state were not audited.
- **Acceptance criteria:** a written audit with screenshots of each modal at 390px and 1280px in both themes, and a list of defects.
- **Effort:** M.

### B-24. Axe not re-run on every page

- **Evidence:** the axe run covered the public pages, dashboard, courses, tasks, calendar and profile; it did not cover planner, mood, quizzes, contacts, flashcards, advisor, Degree Compass and detail pages.
- **Acceptance criteria:** zero violations on all routes in both themes, or each remaining one listed with a reason.
- **Effort:** S to M.

---

## P3: reliability, tests and tooling

### B-25. Intermittent build failure on the font download

- **Evidence:** one merge commit failed the "Run Build" step and passed on the next run; it matches the known Google Fonts download flake.
- **Acceptance criteria:** the build no longer depends on a network download at build time (self-host the font), or the flake is documented with a retry.
- **Effort:** S.

### B-26. Broaden the end-to-end suite

- **Evidence:** the suite covers sign-in, dashboard, delete, Undo, the calendar feed and data isolation.
- **Acceptance criteria:** add cases for the sample semester, steps, account deletion, the course page, and the large-upload path (stand-in AI server).
- **Effort:** M.

### B-27. Check production for the bucket error

- **Evidence:** before #322, routes that read stored files could throw "Bucket name not specified" where `FIREBASE_CONFIG` is not set.
- **Decision for George:** search the Vercel runtime logs for that message to see whether students were affected.
- **Effort:** S.

### B-28. Storage rules deploy permission

- **Evidence:** #327 deploys `storage.rules` automatically; the service account may lack the Rules Admin role.
- **Acceptance criteria:** the first change to `storage.rules` after merge deploys, or the role is granted.
- **Effort:** S.

### B-29. Untested component surface

- **Evidence:** #330 added 149 tests for the Advisor, quizzes, mood, auth and landing page; course detail modals, the planner, contacts and the syllabus autofill flow still have thin component tests.
- **Effort:** M.

---

## P4: structural debt (not for the prototype window)

### B-30. Split the two largest components

- `src/components/syllabus/SyllabusAutofillModal.tsx` (2,433 lines) and `src/components/courses/CourseDetailView.tsx` (1,590 lines). Acceptance: no behaviour change, tests unchanged and green, each file under about 600 lines. **Effort:** L.

### B-31. Major upgrades

- Next 16, React 19, Firebase 13, Tailwind 4, ESLint 10. They also clear the remaining 6 high production advisories (Firebase, gRPC, postcss). Owner decision on timing; one upgrade per PR. **Effort:** L each.

---

## Done in this project (for context)

Dependency clean-up and unused library removed (#317); extraction reliability with repair of partly bad results (#318); accessibility pass (#319); Undo for tasks and contacts (#320); admin Storage bucket fix (#322); uploads up to 10MB through Storage (#323); sample semester (#324); calendar feed (#325); end-to-end suite (#326); Storage rules deploy (#327); Degree Compass planner (#328); task steps (#329); component tests (#330); contrast test, skip link and landmarks (#331); quiz data safety (#332); sign-in error announcements (#333); steps pill (#334); Undo end-to-end test (#335); mood router fix (#336); Vercel evidence-branch setting (#338). Open: #321 (on hold), #337 (end-to-end test for the calendar feed).
