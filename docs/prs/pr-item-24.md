# PR: Item 24 — Courses List Subject Icon Glyphs & Typography

## 5-Role Justification

- **Student**: Instant visual recognition of subject areas (STEM, Humanities, Arts, Business) through curated subject glyphs.
- **UX**: Cohesive card typography with color-coded badges and truncation defense.
- **PM**: High visual delight and polished course management cards.
- **PO**: Differentiated academic visual identity.
- **Dev**: Curated subject icon registry and fallback engine in `src/lib/courseIcons.ts`.

## Verification

- `npm test src/lib/__tests__/courseIcons.test.ts` (7/7 pass)
- `npx tsc --noEmit` (0 errors)
- `npm run lint` (0 errors)
