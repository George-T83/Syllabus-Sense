# PR: Item 41 — Professor Email Drafter & Office Hours Booking Modal

## 5-Role Justification

- **Student**: One-click generate polite, professionally worded emails to professors using syllabus etiquette (`howToAddress`).
- **UX**: 4 pre-filled template tabs (Extension, Absence, Question, Office Hours) with one-click copy to clipboard.
- **PM**: High academic communication confidence for students.
- **PO**: Seamless integration with course contacts directory.
- **Dev**: `src/components/contacts/ProfessorEmailDrafterModal.tsx` with clipboard copy and template interpolators.

## Verification

- `npm run lint` (0 errors)
- `npx tsc --noEmit` (0 errors)
- `npm run build` (20 routes)
