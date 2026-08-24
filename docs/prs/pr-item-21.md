# Pull Request: Item 21 — Mobile Touch Targets Minimum 44x44px Audit & Hardening

**Branch**: `item-21-mobile-touch-targets-44px` → `overnight/2026-08-24`
**Scope**: `src/components/schedule/PlannerView.tsx`, `src/components/contacts/ContactsListView.tsx`, `src/components/layout/Navbar.tsx`, `src/components/calendar/MonthCalendar.tsx`, `src/components/ui/CardAction.tsx`, `src/lib/__tests__/mobileTouchTargets.test.tsx`

## 5-Role Perspective Write-up

- **Student**: Effortlessly tap action buttons, filter dropdowns, search triggers, notification bell, and calendar period navigation on mobile devices without misclicking adjacent elements or needing to pinch-to-zoom.
- **UX**: Conforms to Apple Human Interface Guidelines and Android Material Design touch target standards with minimum 44x44px interactive bounding boxes across buttons, select dropdowns, search inputs, icon actions, and period navigation pills.
- **PM**: Eliminates mobile interaction friction and drops accidental misclick rates for students managing their schedule on smartphones and tablets.
- **PO**: Satisfies WCAG 2.5.5 (Target Size - Enhanced) and WCAG 2.5.8 (Target Size - Minimum) Level AA accessibility criteria across core student navigation and action flows.
- **Dev**: Refactored `selectClass` styles, action button wrappers, `CardActionButton`/`CardActionLink`, `PeriodNav` (prev, today, next buttons), and `Navbar` utility icons to enforce `min-h-[44px]` (and `min-w-[44px]` on icon actions) with `inline-flex items-center justify-center` centering. Added comprehensive component test suite in `src/lib/__tests__/mobileTouchTargets.test.tsx`.

## Verification Results

- `npm run lint`: 0 errors, 0 warnings
- `npx tsc --noEmit`: 0 errors (exit code 0)
- `npm test src/lib/__tests__/mobileTouchTargets.test.tsx`: 5/5 passed (100%)
- `npm test`: 30 suites passed, 260 tests passed (100%)
- `npm run build`: 18 routes compiled successfully
