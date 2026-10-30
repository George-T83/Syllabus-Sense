/**
 * What a term creation form suggests for a label it recognizes. These are
 * only ever shown as a pre-filled suggestion the student confirms or adjusts
 * before a term is stored; nothing applies them to a term the student has
 * not defined.
 */

export interface DateRange {
  /** `YYYY-MM-DD` */
  startDate: string;
  /** `YYYY-MM-DD` */
  endDate: string;
}

/** Longest term the app will store: a full year, so a mistyped end date
 * cannot make an unreadable multi-year range. */
export const MAX_TERM_DAYS = 366;

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

/** Typical US semester dates as month-day pairs. Defaults, not facts about
 * any one school. Winter is left out on purpose: it means a January term at
 * some schools and a Jan-Mar quarter at others. */
const STANDARD: Record<string, { start: string; end: string }> = {
  spring: { start: '01-12', end: '05-15' },
  summer: { start: '05-26', end: '08-14' },
  fall: { start: '08-24', end: '12-18' },
};

const LABEL = /^(spring|summer|fall|winter)\s+(\d{4})$/i;

/** The suggested first and last day for a label like "Fall 2026", or null
 * when the label has no standard dates (anything else, and Winter). */
export function standardTermDates(label: string): DateRange | null {
  const match = LABEL.exec(label.trim());
  if (!match) return null;
  const season = STANDARD[match[1].toLowerCase()];
  if (!season) return null;
  return { startDate: `${match[2]}-${season.start}`, endDate: `${match[2]}-${season.end}` };
}

/** A label to suggest when a student with no terms creates their first one:
 * the standard term containing `dayKey`. A suggestion in the form, nothing
 * more. */
export function suggestTermLabel(dayKey: string): string {
  const year = dayKey.slice(0, 4);
  const monthDay = dayKey.slice(5);
  if (monthDay <= '05-15') return `Spring ${year}`;
  if (monthDay <= '08-15') return `Summer ${year}`;
  return `Fall ${year}`;
}

/** A label with case and spacing ignored, for telling whether two labels
 * name the same term. */
export function termLabelKey(label: string): string {
  return label.trim().replace(/\s+/g, ' ').toLowerCase();
}

function isRealDayKey(value: string): boolean {
  if (!DAY_KEY.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

function daysBetween(start: string, end: string): number {
  const [sy, sm, sd] = start.split('-').map(Number);
  const [ey, em, ed] = end.split('-').map(Number);
  return Math.round((Date.UTC(ey, em - 1, ed) - Date.UTC(sy, sm - 1, sd)) / DAY_MS);
}

/** A message for the student when the dates cannot be used, else null. */
export function validateTermDates(startDate: string, endDate: string): string | null {
  if (!isRealDayKey(startDate) || !isRealDayKey(endDate)) {
    return 'Enter both a first and a last day.';
  }
  if (endDate < startDate) return 'The last day has to come after the first day.';
  if (daysBetween(startDate, endDate) + 1 > MAX_TERM_DAYS) {
    return `A term can be at most ${MAX_TERM_DAYS} days long.`;
  }
  return null;
}

/** Whether `term` can be stored and drawn: a real range and a label. */
export function isUsableTerm(term: { label: string; startDate: string; endDate: string }): boolean {
  return term.label.trim() !== '' && validateTermDates(term.startDate, term.endDate) === null;
}
