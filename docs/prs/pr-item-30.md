# PR: Item 30 — Filter-Aware Contextual Empty States

## 5-Role Justification

- **Student**: When search filters yield 0 results, an instant "Clear Filters" button immediately restores all tasks.
- **UX**: Helpful contextual iconography, friendly guidance copy, and clear call-to-action buttons.
- **PM**: Minimized student drop-off and frustration when filtering tasks and courses.
- **PO**: Engaging zero-state user guidance.
- **Dev**: Reusable `EmptyState.tsx` component with custom title, message, icon, and optional action button.

## Verification

- `npm test src/lib/__tests__/EmptyState.test.tsx` (4/4 pass)
- `npx tsc --noEmit` (0 errors)
- `npm run lint` (0 errors)
