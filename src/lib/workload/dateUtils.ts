/**
 * Small set of date-only helpers used throughout the workload engine.
 *
 * All workload calculations operate on calendar days, not instants, so every
 * date is normalized to UTC midnight ("date-only") before any arithmetic.
 * Using UTC (rather than local time) keeps the engine deterministic
 * regardless of the machine/timezone running it, which matters for tests.
 */

/** Parses an ISO date/datetime string (or Date) into a UTC-midnight Date. */
export function toDateOnly(input: string | Date): Date {
  const d = typeof input === 'string' ? new Date(input) : input;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
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
