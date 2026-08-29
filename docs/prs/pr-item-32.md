# PR: Item 32 — RateMyProfessor Professor Name Sanitation

## 5-Role Justification

- **Student**: Direct one-click lookup to RateMyProfessors even when syllabus lists titles like "Prof. Dr. First M. Last, Ph.D.".
- **UX**: 100% working external lookup links that open pre-filled search queries.
- **PM**: High utility academic link integration.
- **PO**: Reliable third-party lookup without dead links or garbled query params.
- **Dev**: Multi-pattern regex sanitizer in `src/lib/export/rateMyProfessor.ts` removing academic honorifics and suffixes.

## Verification

- `npm test src/lib/__tests__/rateMyProfessor.test.ts` (14/14 pass)
- `npx tsc --noEmit` (0 errors)
- `npm run lint` (0 errors)
