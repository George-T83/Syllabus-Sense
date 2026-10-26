import { eachDayOfRange, parseDayKey, toDayKey } from '@/lib/calendar/dates';
import type { MoodValue } from '@/types/mood';

/**
 * The first and last day of a semester, for the check-in history grid.
 *
 * Courses only carry a term *label* ("Fall 2026"), so the boundaries come
 * from one of two places and are always shown to the student as such:
 *  - a range the student set for that term (stored in their preferences), or
 *  - the standard dates below for Spring, Summer and Fall.
 * A label with neither (for example "Winter 2027", which means different
 * things at different schools) has no boundaries. It is reported as unknown
 * so the student can set them; the range is never guessed from due dates.
 */

export interface SemesterDates {
  /** First day, `YYYY-MM-DD`. */
  start: string;
  /** Last day, `YYYY-MM-DD`. */
  end: string;
}

export interface SemesterRange extends SemesterDates {
  term: string;
  /** 'custom' = set by the student; 'standard' = the defaults below. */
  source: 'custom' | 'standard';
}

export type SemesterResolution =
  { kind: 'ok'; range: SemesterRange } | { kind: 'unknown'; term: string };

/** Longest range the grid will draw: a full year, so a mistyped end date
 * can't produce an unreadable multi-year grid. */
export const MAX_SEMESTER_DAYS = 366;

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

/**
 * Typical US semester dates, as month-day pairs. They are defaults, not facts
 * about any one school: the grid labels them "Standard dates" and offers
 * "Adjust dates" next to them.
 */
const STANDARD_TERMS: Record<string, { start: string; end: string }> = {
  spring: { start: '01-12', end: '05-15' },
  summer: { start: '05-26', end: '08-14' },
  fall: { start: '08-24', end: '12-18' },
};

const TERM_LABEL = /(spring|summer|fall|winter)\s+(\d{4})/i;

/** The default dates for a term label, or null when the label has no
 * standard dates (an unrecognized label, or Winter). */
export function standardSemesterDates(term: string): SemesterDates | null {
  const match = TERM_LABEL.exec(term);
  if (!match) return null;
  const season = STANDARD_TERMS[match[1].toLowerCase()];
  if (!season) return null;
  const year = match[2];
  return { start: `${year}-${season.start}`, end: `${year}-${season.end}` };
}

/** Which standard term a calendar day falls in, as a label ("Fall 2026").
 * Only used when the student has no active term at all (no courses, or "All
 * Terms" selected); the grid says which term it chose. */
export function termForDate(dayKey: string): string {
  const year = dayKey.slice(0, 4);
  const monthDay = dayKey.slice(5);
  if (monthDay <= '05-15') return `Spring ${year}`;
  if (monthDay <= '08-15') return `Summer ${year}`;
  return `Fall ${year}`;
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

/** A message for the student when the dates can't be used, else null. */
export function validateSemesterDates(start: string, end: string): string | null {
  if (!isRealDayKey(start) || !isRealDayKey(end)) return 'Enter both a first and a last day.';
  if (end < start) return 'The last day has to come after the first day.';
  if (daysBetween(start, end) + 1 > MAX_SEMESTER_DAYS) {
    return `A semester can be at most ${MAX_SEMESTER_DAYS} days long.`;
  }
  return null;
}

/**
 * The boundaries for the active term. `term` is the app's active term label,
 * or null when there is none, in which case the standard term containing
 * `todayKey` is used. `overrides` is the student's saved ranges by term
 * label; a null or unusable entry counts as not set.
 */
export function resolveSemesterRange(
  term: string | null,
  todayKey: string,
  overrides?: Record<string, SemesterDates | null>,
): SemesterResolution {
  const label = term ?? termForDate(todayKey);
  const custom = overrides?.[label];
  if (custom && validateSemesterDates(custom.start, custom.end) === null) {
    return {
      kind: 'ok',
      range: { term: label, start: custom.start, end: custom.end, source: 'custom' },
    };
  }
  const standard = standardSemesterDates(label);
  if (standard) {
    return { kind: 'ok', range: { term: label, ...standard, source: 'standard' } };
  }
  return { kind: 'unknown', term: label };
}

export type GridPhase = 'past' | 'today' | 'future';

export interface GridCell {
  /** Empty for the padding cells that line the first week up under Sunday. */
  dateKey: string;
  mood: MoodValue | null;
  phase: GridPhase;
}

export interface SemesterGrid {
  cells: GridCell[];
  /** Check-ins dated outside the semester, which the grid does not show. */
  outsideCount: number;
}

/**
 * One cell per day from the first to the last day of the semester, Sunday
 * first, padded so the first day sits under its weekday. Its length depends
 * only on `range`: not on how many check-ins or tasks exist.
 */
export function buildSemesterGrid(
  range: SemesterDates,
  moodByDay: Map<string, MoodValue>,
  todayKey: string,
): SemesterGrid {
  const start = parseDayKey(range.start);
  const end = parseDayKey(range.end);
  const cells: GridCell[] = Array.from({ length: start.getDay() }, () => ({
    dateKey: '',
    mood: null,
    phase: 'past' as const,
  }));
  for (const day of eachDayOfRange(start, end)) {
    const dateKey = toDayKey(day);
    const phase: GridPhase =
      dateKey < todayKey ? 'past' : dateKey === todayKey ? 'today' : 'future';
    cells.push({ dateKey, mood: moodByDay.get(dateKey) ?? null, phase });
  }
  let outsideCount = 0;
  Array.from(moodByDay.keys()).forEach((key) => {
    if (key < range.start || key > range.end) outsideCount += 1;
  });
  return { cells, outsideCount };
}
