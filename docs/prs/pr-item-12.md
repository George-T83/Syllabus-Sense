# Pull Request: Item 12 — Course Term Cascade to Associated Contacts

**Branch**: `item-12-course-term-cascade-contacts` → `overnight/2026-08-24`
**Commit**: Pending merge

## 5-Role Perspective Write-up

- **Student**: Updating a course's semester/term (e.g. moving a syllabus from "Fall 2026" to "Spring 2027") automatically keeps all course professors and TAs aligned under the new semester in the Contacts directory, eliminating missing contacts or mismatched semester filters.
- **UX**: Seamless relational consistency between Courses and Contacts views. Switching semester tabs in the navigation immediately surfaces the right professors and office hours without manual contact edits.
- **PM**: Maintains data model integrity and relational cohesion across academic terms, avoiding stale metadata and orphaned semester associations.
- **PO**: Satisfies Milestone 3 cascading updates requirement for course-contact term synchronization.
- **Dev**: Enhanced `updateCourse` in `src/lib/firestore/courses.ts` and `updateCourseContactsTerm` in `src/lib/firestore/contacts.ts` to detect term changes, optimistically dispatch `UPDATE_CONTACT`, and atomically persist course and contact changes via Firestore `writeBatch`. Updated `CourseDetailView.tsx` to pass `courseContacts` to `updateCourse` and clear terms when left blank. Added comprehensive unit tests in `src/lib/__tests__/firestoreCourses.test.ts` (13 tests) and `src/lib/__tests__/firestoreContacts.test.ts` (9 tests).

## Verification Results

- `npm run lint`: 0 errors, 0 warnings
- `npx tsc --noEmit`: 0 errors (exit code 0)
- `npm test`: 29 test files passed, 252 tests passed (22/22 in Item 12 test suites)
- `npm run build`: Verified build compilation
