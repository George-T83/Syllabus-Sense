# PR: Item 17 — Term Switcher Listbox Accessibility

## 5-Role Justification

- **Student**: Effortlessly switch terms using keyboard arrow keys and Enter/Space with screen reader feedback.
- **UX**: High contrast active focus state and clear dropdown popover elevation.
- **PM**: Frictionless semester switching across dashboard, courses, and planner.
- **PO**: WAI-ARIA Listbox Pattern compliance.
- **Dev**: ARIA listbox implementation with `role="listbox"`, `role="option"`, `aria-selected`, and `aria-expanded`.

## Verification

- `npm test src/lib/__tests__/termResolution.test.ts` (6/6 pass)
- `npx tsc --noEmit` (0 errors)
- `npm run lint` (0 errors)
