# Pull Request: Item 37 — Weekly Cognitive Workload Radar & Stress Heatmap Chart

**Branch**: `item-37-weekly-cognitive-workload-radar-chart` → `overnight/2026-08-24`
**Commit**: `feat(dashboard): weekly cognitive workload radar chart and burnout defense engine (Item 37)`

## 5-Role Perspective Write-up

- **Student**: Students gain a bird's-eye visual polygon of their weekly mental pressure across 6 distinct academic load vectors (Exam Stakes, Deliverables Volume, Reading Density, Class Hours, Project Complexity, and Deadline Proximity). Proactive burnout defense suggestions help them start high-stakes projects 3 days early before deadline collisions.
- **UX**: Engineered an SVG radar spider chart with concentric percentage grid rings, glowing data polygons, interactive spoke hover effects, status badges (Balanced, Optimal High Intensity, High Burnout Warning), and an accessible data table alternative for screen readers.
- **PM**: Differentiates Syllabus Sense from standard calendar apps by offering cognitive stress modeling rather than plain deadline lists. Provides tangible student burnout mitigation that improves academic stamina and term success.
- **PO**: Satisfies Wave 3 Revolutionary Features Item 37. Complete WCAG 2.1 AA accessibility (`role="region"`, `aria-label`, data table alternative, clean mobile rendering at 375px).
- **Dev**: Built `src/components/dashboard/WorkloadRadarChart.tsx` using mathematical polar-to-Cartesian trigonometry, dynamic load scoring connected to `AppStateContext` courses and schedule items, and responsive SVG viewBox geometry.

## Verification Results

- `npm run lint`: 0 errors, 0 warnings
- `npx tsc --noEmit`: 0 type errors
- `npm test`: 5/5 unit tests passed in `WorkloadRadarChart.test.tsx`
- Visual Screenshots:
  - `docs/screenshots/item-37-weekly-workload-radar-desktop-1440.png`
  - `docs/screenshots/item-37-weekly-workload-radar-mobile-375.png`
