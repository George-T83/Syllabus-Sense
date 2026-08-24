# PR: Item 01 — Cascade Delete Course Contacts on Course Deletion

## 5-Role Justification

- **Student**: Never sees orphaned contacts or confusing TA details from deleted courses in their contacts directory.
- **UX**: Seamless course deletion with zero ghost records or stale cards left behind.
- **PM**: Clean data lifecycle management and high user trust in data hygiene.
- **PO**: GDPR/privacy compliance and zero orphaned relational records.
- **Dev**: Atomic batch transaction in `src/lib/firebase/firestoreCourses.ts` deleting all child contacts when a course is removed.

## Changes

- `src/lib/firebase/firestoreCourses.ts`: Added batch deletion of affiliated contacts query during course deletion.
- `src/lib/__tests__/firestoreCourses.test.ts`: Added unit test coverage for contact cascading deletion.

## Verification

- `npm test src/lib/__tests__/firestoreCourses.test.ts` (13/13 pass)
- `npx tsc --noEmit` (0 errors)
- `npm run lint` (0 errors)
