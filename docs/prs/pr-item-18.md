# PR: Item 18 — Avatar & Course Color Picker Accessible Spoken Labels

## 5-Role Justification

- **Student**: Visually impaired students receive spoken color names (e.g. "Royal Blue", "Emerald Green", "Warm Amber") rather than raw hex codes.
- **UX**: Polished profile customization and course branding.
- **PM**: 100% accessible personal branding throughout the application.
- **PO**: WCAG 1.3.1 Info and Relationships compliance.
- **Dev**: Descriptive `aria-label` color names mapped via `COURSE_COLORS` in `src/lib/courseColors.ts`.

## Verification

- `npm test src/lib/__tests__/courseColors.test.ts` (5/5 pass)
- `npx tsc --noEmit` (0 errors)
- `npm run lint` (0 errors)
