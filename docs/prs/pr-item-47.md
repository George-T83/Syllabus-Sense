# Pull Request: Item 47 Semester GPA Goal Radial Progress Tracker

**Branch**: `item-47-semester-gpa-goal-radial-tracker` → `overnight/2026-08-24`
**Scope**: `src/lib/gpa/gpaMath.ts`, `src/lib/gpa/__tests__/gpaMath.test.ts`, `src/components/profile/GpaGoalRadial.tsx`, `src/components/profile/__tests__/GpaGoalRadial.test.tsx`

## 5-Role Perspective Write-up

- **Student**: Set semester and graduation GPA targets (e.g. 3.60 cumulative) and instantly see the exact term GPA and quality points required across current enrolled course loads to hit that goal.
- **UX**: Eye-catching dual concentric animated SVG radial rings displaying term GPA on the outer ring and cumulative progress on the inner ring, paired with a grade simulator table and real-time status badges (Ahead, On Track, At Risk, Out of Reach).
- **PM**: Inspires ongoing academic achievement and retention by translating abstract letter grades into concrete quality points and actionable semester milestones.
- **PO**: Connects individual assignment grades with broader degree progress and academic honors targets, positioning Syllabus Sense as the student's holistic academic copilot.
- **Dev**: Rigorous mathematical GPA and quality points engine in `src/lib/gpa/gpaMath.ts` supporting 4.0 letter grade scales and dynamic target trajectory calculations. Covered by 8 comprehensive unit tests in `gpaMath.test.ts` and `GpaGoalRadial.test.tsx`.

## Verification Results

- `npm run lint`: 0 errors, 0 warnings
- `npx tsc --noEmit`: 0 errors (exit code 0)
- `npm test src/lib/gpa/__tests__/gpaMath.test.ts src/components/profile/__tests__/GpaGoalRadial.test.tsx`: 8/8 tests passed
- `npm run build`: 19 routes successfully compiled
- Visual Captures:
  - Desktop 1440px: `docs/screenshots/item-47-semester-gpa-goal-radial-desktop-1440.png`
  - Mobile 375px: `docs/screenshots/item-47-semester-gpa-goal-radial-mobile-375.png`
