/**
 * Small set of date-only helpers used throughout the workload engine.
 *
 * All workload calculations operate on calendar days, not instants, so every
 * date is normalized to a UTC-midnight Date ("date-only") before any
 * arithmetic - `addDays`/`diffInDays`/`enumerateDays` all assume their inputs
 * are already in that stable form. That normalization step is the one place
 * that has to be careful about *which* calendar day a given input means.
 */

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Parses an ISO date/datetime string (or Date) into a UTC-midnight Date
 * representing the correct calendar day - three input shapes, three rules:
 *
 * - A `Date` object is assumed to already be a UTC-midnight calendar day
 *   (the convention every caller in this codebase follows, e.g.
 *   `getLocalReferenceDate()`), so it's read back with UTC getters unchanged.
 * - A bare `YYYY-MM-DD` string (no time component - used throughout this
 *   module's own test suite) is parsed digit-by-digit, never through `Date`,
 *   so it can't be shifted by any timezone at all.
 * - A full ISO instant string - what `ScheduleItem.dueDate` actually is in
 *   production (`new Date(`${date}T23:59:00`).toISOString()`, i.e. 23:59 in
 *   whichever timezone created it, converted to UTC) - is read with *local*
 *   getters. This was the actual bug: reading it with UTC getters rolls any
 *   negative-UTC-offset user's evening due date into the next UTC day, so a
 *   Friday-due item's load/heat landed on Saturday. `lib/calendar/dates.ts`
 *   already reads the same values with local getters for exactly this
 *   reason; this brings the workload engine's day-bucketing in line with it.
 */
export function toDateOnly(input: string | Date): Date {
  if (typeof input !== 'string') {
    return new Date(Date.UTC(input.getUTCFullYear(), input.getUTCMonth(), input.getUTCDate()));
  }
  const dateOnly = DATE_ONLY_PATTERN.exec(input);
  if (dateOnly) {
    const [, year, month, day] = dateOnly;
    return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  }
  const d = new Date(input);
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

/** Formats a UTC-midnight Date as an ISO `YYYY-MM-DD` string. */
export function formatDateISO(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Adds `days` (may be negative) to a UTC-midnight Date, returning a new Date. */
export function addDays(date: Date, days: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days));
}

/** Whole-day difference `a - b` in days, for two UTC-midnight Dates. */
export function diffInDays(a: Date, b: Date): number {
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  return Math.round((a.getTime() - b.getTime()) / MS_PER_DAY);
}

/** Returns every UTC-midnight date from `start` to `end`, inclusive, in ascending order. */
export function enumerateDays(start: Date, end: Date): Date[] {
  const days: Date[] = [];
  const span = diffInDays(end, start);
  if (span < 0) return days;
  for (let i = 0; i <= span; i++) {
    days.push(addDays(start, i));
  }
  return days;
}
