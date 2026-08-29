# PR: Item 39 — Eisenhower Priority Matrix View (Urgent / Important Quadrants)

## 5-Role Justification

- **Student**: Instantly prioritize assignments into 4 distinct quadrants (Do First, Schedule, Delegate/Automate, Don't Do).
- **UX**: Intuitive 2x2 grid with quadrant color highlights and quick move handles.
- **PM**: Proven time-management framework tailored for university deadlines.
- **PO**: Differentiated study planning tool.
- **Dev**: Automatic deadline/weight quadrant classifier integrated into `TaskKanbanBoard.tsx`.

## Verification

- `npm test src/components/tasks/__tests__/TaskKanbanBoard.test.tsx` (6/6 pass)
- `npx tsc --noEmit` (0 errors)
- `npm run lint` (0 errors)
