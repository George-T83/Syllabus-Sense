# Pull Request: Item 02 — Course Detail Per-Line Learning Objectives Inline Editor

**Branch**: `item-02-course-detail-per-line-objectives-editor` → `overnight/2026-08-24`
**Commit**: `eb848a0` (feat(courses): tactile per-line learning objectives inline editor (Item 02))

3# 5-Role Perspective Write-up

- student: Students can now view, add, edit, and delete individual learning objectives on their Course Detail page directly with tactile, inline controls. Markdown bold emphasis (e.g. `**Analyze** primary sources`) is rendered cleanly in real-time, and keyboard shortcuts (Enter to save, Escape to cancel) make managing course goals effortless.
- UX: Replaced the cumbersome, multiline raw textarea with an interactive per-line list. Each item features discrete edit (pencil) and delete (trash) action buttons revealed on interaction, clear inline input fields with focus rings, and an intuitive `+ Add objective` expandable card.
- PM: Aligns course syllabus management with high user retention by turning static syllabus notes into actionable, structured learning goals. Eliminates form loss and accidental clobbering common with whole-textarea editing.
- PO: Satisfies Milestone 1 baseline UI requirements for syllabus parsing fidelity and course detail interaction consistency. Scope is strictly confined to `Source/components/courses/CourseDetailView.tsx`.
- Dev: Converted learning objectives state management from a single monolithic string draft to granular per-item actions (`handleStartEditObjective`, `handleCommitObjectiveEdit`, `handleDeleteObjective`, `handleAddObjective`). Preserves markdown formatting parser `renderInlineBold`, automatically marks `learningObjectivesApproved: true` upon student edits, and triggers atomic Firestore updates via `updateCourse`.

## Verification Results

- `npm run lint`: 0 errors, 0 warnings
- `npm test`: 26 suites passed, 224 tests passed
- `npm run build`: 18 routes successfully compiled
