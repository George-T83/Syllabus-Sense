# Pull Request: Item 09 — Course Cascade Syllabi Subcollection & Firebase Storage Cleanup

**Branch**: `item-09-course-cascade-syllabi-storage-cleanup` → `overnight/2026-08-24`
**Commit**: Pending merge

## 5-Role Perspective Write-up

- **Student**: Eliminates ghost syllabus documents and guarantees complete data deletion when a course is dropped or deleted. Uploaded syllabus files (PDFs, docs) are permanently wiped from cloud storage alongside the course record, ensuring personal academic documents leave no trace.
- **UX**: Provides clean, predictable course lifecycle management with atomic Firestore rollbacks on error. Prevents stale syllabus preview cards and orphaned attachments from reappearing in course summaries or syllabus views.
- **PM**: Enforces strict student privacy and storage governance (GDPR / academic data stewardship) by preventing orphaned files from accumulating in Firebase Storage buckets and inflating infrastructure costs.
- **PO**: Completes the Milestone 3 data integrity contract for course deletion lifecycle across all associated subcollections (`courses/{courseId}/syllabi`) and storage assets (`users/{userId}/syllabi/{courseId}/*`).
- **Dev**: Updated `deleteCourse` in `src/lib/firestore/courses.ts` to query `users/{userId}/courses/{courseId}/syllabi`, include all subcollection documents in the atomic batch deletion, and execute resilient Firebase Storage deletion via `deleteObject(ref(storage, storagePath))`. Added `deleteAllCourseSyllabi` in `src/lib/firestore/syllabi.ts` and 4 comprehensive Vitest unit tests in `src/lib/__tests__/firestoreCourses.test.ts`.

## Verification Results

- `npm run lint`: 0 errors, 0 warnings
- `npx tsc --noEmit`: 0 errors (exit code 0)
- `npm test`: 26 test files passed, 231 tests passed (10/10 in `firestoreCourses.test.ts`)
- `npm run build`: Verified build compilation
