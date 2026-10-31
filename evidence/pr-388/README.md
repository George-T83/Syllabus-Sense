# PR #388 — Archived courses are left out of everything in use

The data layer for archiving a course (the Archive / Restore screens are in the next PR). A course with `archivedAt` set, and everything that belongs to it, is left out of every active surface until it is restored. Nothing is deleted.

Real Firebase emulator + Chromium, 1280 and 390, light and dark. `before-*` is `main` (which ignores `archivedAt`), `after-*` is this branch. Seeded account: CSCI 213 and ENGL 110 in use, MATH 201 archived with two tasks and a professor contact.

## What each surface shows (`behavior-before.txt`, `behavior-after.txt`)

| Surface | before (`main`) | after |
|---|---|---|
| Dashboard | MATH 201 and "Linear Algebra Midterm" shown | absent |
| Courses | MATH 201 listed | absent |
| Tasks | "Matrix quiz" listed | absent |
| Contacts | Dr. Noor Haddad listed | absent |
| Calendar (screenshots) | MATH 201 events on the days | absent |
| Calendar feed, the real subscribe URL (HTTP 200) | `CSCI 213: Problem Set 4 \| ENGL 110: Essay draft \| MATH 201: Linear Algebra Midterm \| MATH 201: Matrix quiz` | `CSCI 213: Problem Set 4 \| ENGL 110: Essay draft` |
| Advisor, the request the page sends | `courses: ["CSCI 213","ENGL 110","MATH 201"]`, 4 pending tasks | `courses: ["CSCI 213","ENGL 110"]`, 2 pending tasks |
| Checklist, a student whose only course is archived | course counted, step 1 done | back to step 1 "Add your courses" (`after-only-archived-dashboard-*`) |

Screenshots per surface: `{before,after}-{dashboard,courses,calendar,contacts}-<width>-<theme>.png`, plus `…-only-archived-dashboard-…`. For the captures only, the dev-only emulator banner and the floating Focus Timer / AI Advisor buttons are hidden with injected CSS.

## Tests

`full-suite-PASSING.log`: whole suite, 195 files, 1985 tests. New: the split and identity stability (`archive.test.ts`, `appStateArchive.test.tsx`), the Firestore writes (`firestoreArchive.test.ts`: field merge of `archivedAt`, `deleteField` on restore, roll back on failure), and the server feed (`loadFeedData.test.ts`).
