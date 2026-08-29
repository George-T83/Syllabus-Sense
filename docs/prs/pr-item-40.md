# PR: Item 40 — Smart Exam Collision & Triple-Deadline Alert Engine

## 5-Role Justification

- **Student**: Automatic early warning banner when 2+ exams or 3+ major deliverables fall within the same 48-hour window.
- **UX**: High-visibility warning alert with early study scheduling advice.
- **PM**: Massive stress reduction during midterms and finals.
- **PO**: Proactive AI-grade academic risk detection.
- **Dev**: Interval collision detection algorithm in `src/lib/planner/examCollisionDetector.ts`.

## Verification

- `npm test src/lib/planner/__tests__/examCollisionDetector.test.ts` (7/7 pass)
- `npx tsc --noEmit` (0 errors)
- `npm run lint` (0 errors)
