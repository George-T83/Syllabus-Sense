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
 *   getters. This brings the workload engine's day-bucketing in line with
 *   `lib/calendar/dates.ts`.
 */
export function toDateOnly(input: string | Date): Date {
  if (typeof input !== 'string') {
    return new Date(Date.UTC(input.getUTCFullYear(), input.getUTCMonth(), input.getUTCDate()));
  }
  const dateOnly = DATE_ONLY_PATTERN.exec(input.trim());
  if (dateOnly) {
    const [, year, month, day] = dateOnly;
    return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  }
  const d = new Date(input);
  if (isNaN(d.getTime())) {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  }
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

/**
 * Checks whether a date falls within semester start and end dates (inclusive),
 * timezone-invariant.
 */
export function isWithinSemesterRange(
  date: string | Date,
  semesterStart: string | Date,
  semesterEnd: string | Date
): boolean {
  const target = toDateOnly(date).getTime();
  const start = toDateOnly(semesterStart).getTime();
  const end = toDateOnly(semesterEnd).getTime();
  return target >= start && target <= end;
}

/**
 * Computes remaining calendar days in a semester from a reference date.
 * Returns 0 if reference date is past semester end.
 */
export function getSemesterDaysRemaining(
  referenceDate: string | Date,
  semesterEnd: string | Date
): number {
  const ref = toDateOnly(referenceDate);
  const end = toDateOnly(semesterEnd);
  const diff = diffInDays(end, ref);
  return Math.max(0, diff);
}

/**
 * Checks if a date falls within a semester transition threshold (e.g., transition week).
 */
export function isSemesterTransitionWindow(
  date: string | Date,
  semesterBoundary: string | Date,
  windowDays: number = 7
): boolean {
  const target = toDateOnly(date);
  const boundary = toDateOnly(semesterBoundary);
  return Math.abs(diffInDays(target, boundary)) <= windowDays;
}

