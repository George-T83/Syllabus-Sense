import { describe, it, expect } from 'vitest';
import { buildTermGrid } from '../termGrid';
import type { MoodValue } from '@/types/mood';

describe('buildTermGrid', () => {
  const range = { startDate: '2026-08-24', endDate: '2026-12-18' };
  const days = <T extends { dateKey: string }>(cells: T[]) => cells.filter((c) => c.dateKey);

  it("spans the term's first to last day however little data there is", () => {
    const none = buildTermGrid(range, new Map(), '2026-09-10');
    const one = buildTermGrid(range, new Map<string, MoodValue>([['2026-09-10', 3]]), '2026-09-10');
    // Aug 24 to Dec 18 inclusive: 8 + 30 + 31 + 30 + 18 = 117 days.
    expect(days(none.cells)).toHaveLength(117);
    expect(days(one.cells)).toHaveLength(117);
    expect(days(none.cells)[0].dateKey).toBe('2026-08-24');
    expect(days(none.cells).at(-1)?.dateKey).toBe('2026-12-18');
  });

  it('draws a term of any length from its own dates', () => {
    const short = buildTermGrid(
      { startDate: '2027-01-04', endDate: '2027-03-19' },
      new Map(),
      '2027-02-01',
    );
    expect(days(short.cells)).toHaveLength(75);
  });

  it('pads the first week so the first day sits under its weekday (Sunday first)', () => {
    // 24 Aug 2026 is a Monday.
    const { cells } = buildTermGrid(range, new Map(), '2026-09-10');
    expect(cells.slice(0, 2).map((c) => c.dateKey)).toEqual(['', '2026-08-24']);
  });

  it('marks days before today past, today today, and later days future', () => {
    const { cells } = buildTermGrid(range, new Map(), '2026-09-10');
    const phase = (key: string) => cells.find((c) => c.dateKey === key)?.phase;
    expect(phase('2026-09-09')).toBe('past');
    expect(phase('2026-09-10')).toBe('today');
    expect(phase('2026-09-11')).toBe('future');
    expect(phase('2026-12-18')).toBe('future');
  });

  it('puts a check-in on its day and counts ones outside the term', () => {
    const moods = new Map<string, MoodValue>([
      ['2026-09-10', 4],
      ['2026-06-01', 2],
      ['2027-01-05', 1],
    ]);
    const { cells, outsideCount } = buildTermGrid(range, moods, '2026-09-10');
    expect(cells.find((c) => c.dateKey === '2026-09-10')?.mood).toBe(4);
    expect(outsideCount).toBe(2);
  });

  it('shows a term that has not started as all future, and one that is over as all past', () => {
    const upcoming = days(buildTermGrid(range, new Map(), '2026-06-01').cells);
    expect(upcoming.every((c) => c.phase === 'future')).toBe(true);
    const over = days(buildTermGrid(range, new Map(), '2027-02-01').cells);
    expect(over.every((c) => c.phase === 'past')).toBe(true);
  });
});
