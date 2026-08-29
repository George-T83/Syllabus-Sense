# Pull Request: Item 28 — Modular Route Loading Skeletons for Dashboard, Courses, Tasks, Calendar

**Branch**: `item-28-route-loading-skeletons` → `overnight/2026-08-24`
**Category**: Reliability & Perceived Performance

## 5-Role Perspective Write-up

- **Student**: Experiences fluid, flicker-free navigation across Dashboard, Courses, Tasks/Planner, and Calendar tabs, even on slow campus Wi-Fi or cellular connections, with instant visual structure rather than blank screen stalls.
- **UX**: Replaces jarring white flashes with subtle, accessible pulse-shimmer skeletons that precisely mirror the geometry of destination routes (cards, stat chips, time grids, filter bars).
- **PM**: Boosts perceived app performance and user retention by keeping users visually engaged during Next.js client-side route transitions and data hydration.
- **PO**: Adheres to Next.js 14 App Router conventions by placing colocated `loading.tsx` files inside `(app)/dashboard`, `(app)/courses`, `(app)/tasks`, `(app)/calendar`, and `(app)/contacts`.
- **Dev**: Implemented a reusable, typed suite in `src/components/ui/Skeleton.tsx` (`Skeleton`, `SkeletonText`, `SkeletonCard`, `SkeletonButton`) featuring ARIA loading semantics (`role="status"`, `aria-busy="true"`, `aria-live="polite"`), and verified full test coverage in `src/lib/__tests__/Skeleton.test.tsx`.

## Verification Results

- `npm run lint`: 0 errors, 0 warnings
- `npx tsc --noEmit`: 0 type errors
- `npm test src/lib/__tests__/Skeleton.test.tsx`: 12/12 tests passed
- `npm test`: All tests passed
