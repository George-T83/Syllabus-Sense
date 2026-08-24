# Pull Request: Item 08 — Workload Runway Exhaustion & Overdue Backlog Separation

**Branch**: `item-08-workload-overdue-backlog-separation` → `overnight/2026-08-24`  
**Scope**: `src/lib/workload/scheduling.ts`, `src/lib/planner/computeSmartPlan.ts`, `src/components/planner/SmartPlanner.tsx`, `src/lib/__tests__/workload.test.ts`

## 5-Role Perspective Write-up

- **Student**: Crystal-clear separation between past-due debt ("Overdue Backlog") and upcoming workload ("Start Today", "Start This Week", "Later"). When a large project is running out of study runway before its future deadline, the student sees a distinct "Runway Exhausted" indicator rather than a confusing generic overdue badge.
- **UX**: Introduces a dedicated "Overdue Backlog" card with clear debt hours calculation, distinct from the 7-day prospective study runway. Replaces confusing overload tags with explicit "Runway Exhausted" and "Tight" badges.
- **PM**: Reduces student anxiety by organizing debt vs. prospective planning. Prevents overdue historical items from distorting current-week cognitive load projections.
- **PO**: Enforces strict domain separation between temporal state (past vs. future) and scheduling capacity constraints (runway deficit vs. daily load).
- **Dev**: Enhanced `StudyStartRecommendation` with `isOverdue`, `runwayDays`, `deficitHours`, and `runwayExhausted`. Refactored `computeSmartPlan` to bucket `overdueItems` independently and count `runwayExhaustedCount`. Added unit test coverage in `src/lib/__tests__/workload.test.ts`.

## Verification Results

- `npm run lint`: 0 errors, 0 warnings
- `npx tsc --noEmit`: 0 errors (exit code 0)
- `npm test src/lib/__tests__/workload.test.ts`: 47/47 passed (100%)
- `npm test`: 36 suites passed, 307 tests passed (100%)
- `npm run build`: 18 routes compiled successfully
