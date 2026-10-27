import { eachDayOfRange, parseDayKey, toDayKey } from '@/lib/calendar/dates';
import type { MoodValue } from '@/types/mood';

/**
 * The cells of the check-in history grid. The range is a term's own first
 * and last day (types/term.ts) and nothing else: not due dates, not
 * check-ins.
 */

export type GridPhase = 'past' | 'today' | 'future';

export interface GridCell {
  /** Empty for the padding cells that line the first week up under Sunday. */
  dateKey: string;
  mood: MoodValue | null;
  phase: GridPhase;
}

export interface TermGrid {
  cells: GridCell[];
  /** Check-ins dated outside the semester, which the grid does not show. */
  outsideCount: number;
}

/**
 * One cell per day from the first to the last day of the term, Sunday
 * first, padded so the first day sits under its weekday. Its length depends
 * only on `range`: not on how many check-ins or tasks exist.
 */
export function buildTermGrid(
  range: { startDate: string; endDate: string },
  moodByDay: Map<string, MoodValue>,
  todayKey: string,
): TermGrid {
  const start = parseDayKey(range.startDate);
  const end = parseDayKey(range.endDate);
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
    if (key < range.startDate || key > range.endDate) outsideCount += 1;
  });
  return { cells, outsideCount };
}
