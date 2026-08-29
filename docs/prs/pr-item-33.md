# PR: Item 33 — Calendar ICS DTEND Exclusivity & Timezone Defense

## 5-Role Justification

- **Student**: Exported all-day assignments appear on the exact intended calendar date in Apple, Google, and Outlook Calendars without spanning an extra ghost day.
- **UX**: Precise calendar alignment matching the in-app view.
- **PM**: Seamless calendar synchronization that students can trust.
- **PO**: Strict RFC 5545 iCalendar specification compliance.
- **Dev**: Exclusive `DTEND` date calculation and UTC formatting in `src/lib/export/ics.ts` and `src/lib/export/dateUtils.ts`.

## Verification

- `npm test src/lib/__tests__/ics.test.ts src/lib/__tests__/exportDateUtils.test.ts` (32/32 pass)
- `npx tsc --noEmit` (0 errors)
- `npm run lint` (0 errors)
