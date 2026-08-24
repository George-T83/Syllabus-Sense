# Pull Request: Item 07 — Semester Transition & Timezone Date Key Defense

**Branch**: `item-07-workload-timezone-date-defense` → `overnight/2026-08-24`  
**Scope**: `src/lib/workload/dateUtils.ts`, `src/lib/calendar/dates.ts`, `src/lib/__tests__/calendarDates.test.ts`, `src/lib/__tests__/dateDefense.test.ts`

## 5-Role Perspective Write-up

- **Student**: Traveling across timezones or studying during semester transitions (Fall to Spring, Leap Day, Year-end) never shifts homework due dates, exam markers, or cognitive load heatmaps onto adjacent days.
- **UX**: Guarantees rock-solid calendar grid consistency and planner day-bucketing. Bare date strings (`YYYY-MM-DD`) and full ISO timestamps consistently render on the student's intended calendar date without 1-day phantom shifts in negative UTC offsets (e.g. US Central, Eastern, Pacific).
- **PM**: Eliminates student confusion and deadline dispute support tickets caused by timezone conversions rolling midnight due dates into tomorrow or yesterday.
- **PO**: Enforces strict timezone invariance and semester boundary defense across workload calculations, calendar views, and semester progress tracking.
- **Dev**: Hardened `toDayKey` to accept `Date | string` and parse bare date strings directly without calling `new Date("YYYY-MM-DD")` (which parses as UTC midnight and rolls backward in local negative offsets). Enhanced `toDateOnly` with fallback defenses, and added `isWithinSemesterRange`, `getSemesterDaysRemaining`, `isSemesterTransitionWindow`, and `parseDayKey`. Added 9 comprehensive unit tests in `dateDefense.test.ts` and updated `calendarDates.test.ts`.

## Verification Results

- `npm run lint`: 0 errors, 0 warnings
- `npx tsc --noEmit`: 0 errors (exit code 0)
- `npm test src/lib/__tests__/dateDefense.test.ts src/lib/__tests__/calendarDates.test.ts`: 30/30 passed (100%)
- `npm test`: 33 suites passed, 286 tests passed (100%)
- `npm run build`: 18 routes compiled successfully
