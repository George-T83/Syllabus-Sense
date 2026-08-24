# Pull Request: Item 46 Syllabus Policy Diff & Mid-Semester Revision Detector

**Branch**: `item-46-syllabus-policy-diff-revision-detector` → `overnight/2026-08-24`
**Scope**: `src/lib/syllabus/diffEngine.ts`, `src/lib/syllabus/__tests__/diffEngine.test.ts`, `src/components/syllabus/SyllabusDiffModal.tsx`, `src/components/syllabus/__tests__/SyllabusDiffModal.test.tsx`

## 5-Role Perspective Write-up

- **Student**: Never miss mid-semester syllabus revisions, shifted midterm dates, adjusted grading weights, or updated late penalties when a professor uploads an updated syllabus version (v2/v3). Visual green/red highlights make changes crystal clear.
- **UX**: Intuitive dual-mode modal offering high-level "Detected Policy Changes" with structured cards and severity badges (Major, Moderate, Minor), alongside a full "Side-by-Side Line Diff" with line numbers and monospace syntax highlighting.
- **PM**: Eliminates student anxiety and grading disputes caused by silent syllabus policy revisions, giving students instant confidence that their study planner and grade calculators reflect the latest official requirements.
- **PO**: Closes the loop on the AI syllabus ingestion pipeline by providing version diffing, policy conflict detection, and selective update synchronization.
- **Dev**: Dynamic programming LCS line-diff engine in `src/lib/syllabus/diffEngine.ts` paired with semantic syllabus section heuristics (grading, late work, attendance, schedule, contacts). Covered by 7 comprehensive unit tests in `diffEngine.test.ts` and `SyllabusDiffModal.test.tsx`.

## Verification Results

- `npm run lint`: 0 errors, 0 warnings
- `npx tsc --noEmit`: 0 errors (exit code 0)
- `npm test src/lib/syllabus/__tests__/diffEngine.test.ts src/components/syllabus/__tests__/SyllabusDiffModal.test.tsx`: 7/7 tests passed
- `npm run build`: 19 routes successfully compiled
- Visual Captures:
  - Desktop 1440px: `docs/screenshots/item-46-syllabus-diff-modal-desktop-1440.png`
  - Mobile 375px: `docs/screenshots/item-46-syllabus-diff-modal-mobile-375.png`
