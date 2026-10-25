/**
 * A due date is stored as `YYYY-MM-DD` and later turned into a Date. The
 * browser rolls an impossible day over (2026-02-31 becomes March 3) and a
 * year like 9999 is accepted by a native date input but is never a real
 * deadline, so both are rejected where dates enter the app.
 */
export const MIN_DUE_YEAR = 1990;
export const MAX_DUE_YEAR = 2100;

/** True when `value` is `YYYY-MM-DD` and names a day that exists on the calendar. */
export function isRealCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

/** A real calendar date inside the range a school deadline can plausibly fall in. */
export function isPlausibleDueDate(value: string): boolean {
  if (!isRealCalendarDate(value)) return false;
  const year = Number(value.slice(0, 4));
  return year >= MIN_DUE_YEAR && year <= MAX_DUE_YEAR;
}
