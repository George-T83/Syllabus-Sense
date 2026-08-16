# Dev test account

A persistent Firebase Auth account for local development and manual testing.
Not a real user — safe to commit, safe to use in screenshots/demos.

- **Email:** `dev-test@syllabussense.dev`
- **Password:** `DevTest2026!Fixture`
- **Display name:** Dev Test Student

Created directly via the Firebase Admin SDK (`auth.createUser`), not through the
signup UI, so it exists independently of any UI changes. Currently has no
Firestore profile/course data attached — once Epic 11's CRUD lands, seed this
account with the mock data from `src/lib/mock-data.ts` (or point it at
`test-fixtures/syllabi/` once Epic 6 extraction exists) so it's a realistic
fixture, not just an empty login.

Do not reuse this password pattern for any real account.
