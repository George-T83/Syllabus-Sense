# Architecture

How the app is put together, for someone about to change it.

## The shape

A Next.js (App Router) app. Pages render on the client against Firebase; a small set of API routes does the work that needs a secret (the AI calls, account deletion, file proxying).

```
src/
  app/            Pages and API routes
    (app)/          Signed-in pages: dashboard, courses, tasks, calendar, flashcards,
                    quizzes, advisor, degree-compass, contacts, mood, profile
    (auth)/         Login and signup
    api/            Server routes (see "Server routes" below)
  components/     UI, one folder per area (dashboard, courses, tasks, degreeCompass, ...)
    ui/             Shared building blocks: Card, CardAction, EmptyState, TaskRow, ...
  context/        AuthContext, AppStateContext (all synced data), ThemeProvider
  hooks/          Small shared hooks
  lib/            Pure logic and Firebase access, grouped by feature
  types/          Shared TypeScript types
```

Rule of thumb: logic that can be a pure function lives in `src/lib/<feature>/` with a test beside it in `__tests__/`, and the component just calls it. Grade maths is in `lib/academic`, degree progress in `lib/degreeCompass`, the dashboard's ranking in `lib/dashboard`.

## Data

Firestore, one tree per user: `users/{uid}/courses`, `scheduleItems`, `flashcards`, `quizzes`, `contacts`, `degreeProfile`, `degreeCourses`, and so on. Security rules are in `firestore.rules` and `storage.rules` and are tested against the emulators (`npm run test:rules`).

`AppStateContext` holds everything the signed-in student has, kept live by listeners in `lib/firestore/useFirestoreSync.ts`. Writes go through the small modules in `lib/firestore/` (one per collection), which the Firestore listeners then reflect back.

Per-device settings (theme, text size, hidden floating buttons, focus sessions) live in `localStorage`, not Firestore. See `lib/display`.

## Server routes

Every route under `src/app/api` verifies the caller's Firebase ID token (`lib/auth/requireUser.ts` and `verifyFirebaseIdToken.ts`) before doing anything.

- `syllabus/*` and `advisor/chat` call the Anthropic API through `lib/ai/anthropic.ts`. Each has a tool definition in `lib/ai/*Tool.ts` so the reply is structured, and each is wired to the per-user usage limit in `lib/ai/aiUsageLimit.ts`, which is currently switched off (see `docs/AI_USAGE_CAP.md`).
- `syllabus/file` streams an uploaded file back from Storage for the in-app viewers.
- `account/delete` removes a user's data and files.

## Dates

A due date is stored as an ISO string. Compare days with the helpers in `lib/calendar/dates.ts` and `lib/planner/projectChunker.ts` (`parseDateString`, `toLocalDateStr`), not with `new Date('YYYY-MM-DD')`, which parses as UTC and turns work due today into "overdue" in some timezones.

## Tests

Vitest with Testing Library for everything under `src` (`npm test`). Firestore and Storage rules run against the emulators (`npm run test:rules`). One Playwright smoke file lives in `e2e/`.
