# Pull Request: Item 49 Late Submission Penalty Curve & Grace Period Advisor

**Branch**: `item-49-late-submission-penalty-grace-advisor` → `overnight/2026-08-24`
**Scope**: `src/lib/policy/latePenalty.ts`, `src/lib/policy/__tests__/latePenalty.test.ts`, `src/components/tasks/LatePenaltyAdvisor.tsx`, `src/components/tasks/__tests__/LatePenaltyAdvisor.test.tsx`

## 5-Role Perspective Write-up

- **Student**: Know exactly what grade deduction to expect before submitting an assignment late (e.g. "Raw Score: 95% → -10% deduction = 85.5% Final (B)"). Automatically protects points by applying semester slip days.
- **UX**: Dynamic dual-slider simulator card featuring interactive late duration (0h to 96h) and raw score sliders, visual SVG penalty decay curve with active hour cursor, and slip-day bank management.
- **PM**: Reduces student deadline panic and enables strategic time-management decisions during intense midterm weeks.
- **PO**: Translates complex syllabus penalty text (tiered decay, daily fixed, hourly penalties, slip days, and hard cutoffs) into a transparent, interactive simulator.
- **Dev**: Comprehensive late penalty calculation engine in `src/lib/policy/latePenalty.ts` modeling 5 syllabus penalty modalities. Covered by 8 thorough unit tests in `latePenalty.test.ts` and `LatePenaltyAdvisor.test.tsx`.

## Verification Results

- `npm run lint`: 0 errors, 0 warnings
- `npx tsc --noEmit`: 0 errors (exit code 0)
- `npm test src/lib/policy/__tests__/latePenalty.test.ts src/components/tasks/__tests__/LatePenaltyAdvisor.test.tsx`: 8/8 tests passed
- `npm run build`: 19 routes successfully compiled
- Visual Captures:
  - Desktop 1440px: `docs/screenshots/item-49-late-penalty-advisor-desktop-1440.png`
  - Mobile 375px: `docs/screenshots/item-49-late-penalty-advisor-mobile-375.png`
