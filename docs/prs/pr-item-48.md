# Pull Request: Item 48 Attendance & Absence Allowance Policy Gauge

**Branch**: `item-48-attendance-absence-allowance-policy-gauge` → `overnight/2026-08-24`
**Scope**: `src/components/courses/AttendanceGauge.tsx`, `src/components/courses/__tests__/AttendanceGauge.test.tsx`

## 5-Role Perspective Write-up

- **Student**: Effortlessly track used vs. remaining allowed unexcused absences (e.g., "2 of 3 absences remaining") against strict course syllabus rules to avoid surprise grade percentage deductions.
- **UX**: Clean animated circular SVG gauge that dynamically shifts colors (Emerald for safe, Amber for 1 remaining, Rose for limit reached / penalties active), paired with an intuitive "Log Absence" modal and absence history table.
- **PM**: Prevents unnecessary course failures and academic disputes by making attendance thresholds transparent and actionable throughout the semester.
- **PO**: Connects raw policy sentences parsed from PDF syllabi with active student behavioral tracking, reinforcing Syllabus Sense's role as a proactive academic guardian.
- **Dev**: Lightweight component in `src/components/courses/AttendanceGauge.tsx` with full ARIA progressbar compliance, excuse categorizations, and deletion actions. Covered by 4 comprehensive unit tests in `AttendanceGauge.test.tsx`.

## Verification Results

- `npm run lint`: 0 errors, 0 warnings
- `npx tsc --noEmit`: 0 errors (exit code 0)
- `npm test src/components/courses/__tests__/AttendanceGauge.test.tsx`: 4/4 tests passed
- `npm run build`: 19 routes successfully compiled
- Visual Captures:
  - Desktop 1440px: `docs/screenshots/item-48-attendance-policy-gauge-desktop-1440.png`
  - Mobile 375px: `docs/screenshots/item-48-attendance-policy-gauge-mobile-375.png`
