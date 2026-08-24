# Pull Request: Item 15 — Month Calendar ARIA Grid Roles & Keyboard Roving Focus

**Branch**: `item-15-calendar-aria-grid-roving-focus` → `overnight/2026-08-24`  
**Scope**: `src/components/calendar/MonthCalendar.tsx`, `src/components/calendar/__tests__/MonthCalendarAriaGrid.test.tsx`

## 5-Role Perspective Write-up

- **Student**: Full, effortless keyboard navigation across all 42 calendar grid cells using standard arrow keys (`ArrowRight`, `ArrowLeft`, `ArrowDown`, `ArrowUp`), `Home` (jump to Sunday), `End` (jump to Saturday), and `PageUp`/`PageDown` (navigate months). Screen readers announce the full date, tasks count, classes, and workload load level on every cell.
- **UX**: Eliminates the arduous 42-tab penalty when tabbing through the calendar. Exactly one day cell holds `tabIndex="0"` (the currently focused or selected day), maintaining smooth roving focus.
- **PM**: Delivers WCAG 2.1 AA and WAI-ARIA Grid pattern compliance for educational institution procurement and accessibility auditing.
- **PO**: Standardizes calendar semantics with `role="grid"`, `role="row"`, `role="columnheader"` with full weekday names (`Sunday`..`Saturday`), and `role="gridcell"` with `aria-selected` and detailed date/task labels.
- **Dev**: Structured month grid into 6 explicit rows with roving focus managed via `focusedDateKey` state and `useRef<Map<string, HTMLButtonElement>>`. Added automated unit test suite with 7 assertions.

## Verification Results

- `npm run lint`: 0 errors
- `npx tsc --noEmit`: 0 errors (exit code 0)
- `npm test src/components/calendar/__tests__/MonthCalendarAriaGrid.test.tsx`: 7/7 passed (100%)
- `npm test`: 43 suites passed, 345 tests passed (100%)
- `npm run build`: 20 routes compiled successfully
