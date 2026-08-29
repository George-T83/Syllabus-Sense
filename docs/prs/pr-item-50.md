# PR: Item 50 — Global Keyboard Shortcuts Cheat Sheet & Help Dialog

## 5-Role Justification

- **Student**: Press `?` or `Cmd+K` anywhere to reveal all keyboard shortcuts across the app.
- **UX**: Accessible two-column shortcut dialog with fuzzy search filtering.
- **PM**: Power-user adoption and high navigation efficiency.
- **PO**: WCAG 2.1.4 Character Key Shortcuts compliance.
- **Dev**: Global keyboard event listeners and accessible modal integration in `CommandPalette.tsx`.

## Verification

- `npm test src/components/common/__tests__/CommandPalette.test.tsx` (8/8 pass)
- `npx tsc --noEmit` (0 errors)
- `npm run lint` (0 errors)
