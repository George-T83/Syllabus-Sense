# Pull Request: Item 36 — What-If Grade Simulator & Target GPA Calculator

**Branch**: `item-36-what-if-grade-simulator-gpa-calculator` → `overnight/2026-08-24`
**Commit**: `feat(courses): what-if grade simulator and target GPA calculator with final exam solver (Item 36)`

## 5-Role Perspective Write-up

- **Student**: Students can now simulate their final course grade and calculate the exact score required on their upcoming final exam (e.g. "You need an 88.5% on the final to earn an A"). They can interactively adjust weights and grades across categories (Homework, Midterms, Projects, Labs) and instantly see the projected impact on their cumulative semester GPA.
- **UX**: Designed a clear, tactile modal dialog with real-time score sliders, category add/delete controls, target grade selector chips (`A (93%)`, `A- (90%)`, `B+ (87%)`, `B (83%)`, `C (73%)`, `Pass (70%)`), color-coded achievement status badges (Achievable, Challenging, Already Secured, Impossible), and a dedicated Semester GPA Impact tab.
- **PM**: Delivers a high-utility academic tool that directly addresses student stress during midterm and finals seasons. Enables proactive academic planning and fosters higher semester completion rates.
- **PO**: Satisfies Wave 3 Revolutionary Features Item 36. Built with WCAG 2.1 AA accessibility (`role="dialog"`, `aria-modal="true"`, labeled number inputs, and keyboard navigation).
- **Dev**: Implemented `src/lib/academic/gradeMath.ts` providing normalized category weighting, target score solving, and 0-credit resilient semester GPA math. Built UI component `src/components/courses/GradeCalculatorModal.tsx` integrated with `AppStateContext`.

## Verification Results

- `npm run lint`: 0 errors, 0 warnings
- `npx tsc --noEmit`: 0 type errors
- `npm test`: 13/13 unit tests passed in `gradeMath.test.ts` and `GradeCalculatorModal.test.tsx`
- Visual Screenshots:
  - `docs/screenshots/item-36-what-if-grade-simulator-desktop-1440.png`
  - `docs/screenshots/item-36-what-if-grade-simulator-mobile-375.png`
