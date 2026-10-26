import { describe, it, expect } from 'vitest';
import {
  buildSemesterGrid,
  resolveSemesterRange,
  standardSemesterDates,
  termForDate,
  validateSemesterDates,
} from '../semesterRange';
import type { MoodValue } from '@/types/mood';

describe('standardSemesterDates', () => {
  it('maps Spring, Summer and Fall labels to a first and last day', () => {
    expect(standardSemesterDates('Fall 2026')).toEqual({ start: '2026-08-24', end: '2026-12-18' });
    expect(standardSemesterDates('Spring 2027')).toEqual({
      start: '2027-01-12',
      end: '2027-05-15',
    });
    expect(standardSemesterDates('summer 2026')).toEqual({
      start: '2026-05-26',
      end: '2026-08-14',
    });
  });

  it('has no standard dates for Winter or an unrecognized label', () => {
    expect(standardSemesterDates('Winter 2027')).toBeNull();
    expect(standardSemesterDates('Block 3')).toBeNull();
    expect(standardSemesterDates('')).toBeNull();
  });
});

describe('termForDate', () => {
  it('picks the standard term a day falls in', () => {
    expect(termForDate('2026-01-03')).toBe('Spring 2026');
    expect(termForDate('2026-05-15')).toBe('Spring 2026');
    expect(termForDate('2026-06-01')).toBe('Summer 2026');
    expect(termForDate('2026-09-10')).toBe('Fall 2026');
    expect(termForDate('2026-12-30')).toBe('Fall 2026');
  });
});

describe('validateSemesterDates', () => {
  it('accepts a normal range', () => {
    expect(validateSemesterDates('2026-08-24', '2026-12-18')).toBeNull();
  });
  it('rejects blanks, impossible dates, reversed ranges and ranges over a year', () => {
    expect(validateSemesterDates('', '2026-12-18')).toMatch(/both/);
    expect(validateSemesterDates('2026-02-30', '2026-12-18')).toMatch(/both/);
    expect(validateSemesterDates('2026-12-18', '2026-08-24')).toMatch(/after/);
    expect(validateSemesterDates('2026-01-01', '2027-02-01')).toMatch(/at most/);
  });
});

describe('resolveSemesterRange', () => {
  it('uses the standard dates for a recognized term', () => {
    expect(resolveSemesterRange('Fall 2026', '2026-09-10')).toEqual({
      kind: 'ok',
      range: { term: 'Fall 2026', start: '2026-08-24', end: '2026-12-18', source: 'standard' },
    });
  });

  it("prefers the student's own dates for that term", () => {
    const result = resolveSemesterRange('Fall 2026', '2026-09-10', {
      'Fall 2026': { start: '2026-09-01', end: '2026-12-10' },
    });
    expect(result).toEqual({
      kind: 'ok',
      range: { term: 'Fall 2026', start: '2026-09-01', end: '2026-12-10', source: 'custom' },
    });
  });

  it('ignores a reset (null) or invalid saved range and falls back to the standard dates', () => {
    for (const bad of [null, { start: '2026-12-10', end: '2026-09-01' }]) {
      const result = resolveSemesterRange('Fall 2026', '2026-09-10', { 'Fall 2026': bad });
      expect(result).toMatchObject({ kind: 'ok', range: { source: 'standard' } });
    }
  });

  it('reports an unrecognized term as unknown instead of guessing a range', () => {
    expect(resolveSemesterRange('Winter 2027', '2026-12-20')).toEqual({
      kind: 'unknown',
      term: 'Winter 2027',
    });
  });

  it('lets a student give an unrecognized term its own dates', () => {
    const result = resolveSemesterRange('Winter 2027', '2026-12-20', {
      'Winter 2027': { start: '2027-01-04', end: '2027-03-19' },
    });
    expect(result).toMatchObject({ kind: 'ok', range: { source: 'custom', start: '2027-01-04' } });
  });

  it('names the standard term containing today when there is no active term', () => {
    expect(resolveSemesterRange(null, '2026-09-10')).toMatchObject({
      kind: 'ok',
      range: { term: 'Fall 2026', source: 'standard' },
    });
  });
});

describe('buildSemesterGrid', () => {
  const range = { start: '2026-08-24', end: '2026-12-18' };
  const days = (cells: { dateKey: string }[]) => cells.filter((c) => c.dateKey);

  it('spans every day of the semester however little data there is', () => {
    const none = buildSemesterGrid(range, new Map(), '2026-09-10');
    const one = buildSemesterGrid(
      range,
      new Map<string, MoodValue>([['2026-09-10', 3]]),
      '2026-09-10',
    );
    // Aug 24 to Dec 18 inclusive: 8 + 30 + 31 + 30 + 18 = 117 days.
    expect(days(none.cells)).toHaveLength(117);
    expect(days(one.cells)).toHaveLength(117);
    expect(days(none.cells)[0].dateKey).toBe('2026-08-24');
    expect(days(none.cells).at(-1)?.dateKey).toBe('2026-12-18');
  });

  it('pads the first week so the first day sits under its weekday (Sunday first)', () => {
    // 24 Aug 2026 is a Monday.
    const { cells } = buildSemesterGrid(range, new Map(), '2026-09-10');
    expect(cells.slice(0, 2).map((c) => c.dateKey)).toEqual(['', '2026-08-24']);
  });

  it('marks days before today past, today today, and later days future', () => {
    const { cells } = buildSemesterGrid(range, new Map(), '2026-09-10');
    const phase = (key: string) => cells.find((c) => c.dateKey === key)?.phase;
    expect(phase('2026-09-09')).toBe('past');
    expect(phase('2026-09-10')).toBe('today');
    expect(phase('2026-09-11')).toBe('future');
    expect(phase('2026-12-18')).toBe('future');
  });

  it('puts a check-in on its day and counts ones outside the semester', () => {
    const moods = new Map<string, MoodValue>([
      ['2026-09-10', 4],
      ['2026-06-01', 2],
      ['2027-01-05', 1],
    ]);
    const { cells, outsideCount } = buildSemesterGrid(range, moods, '2026-09-10');
    expect(cells.find((c) => c.dateKey === '2026-09-10')?.mood).toBe(4);
    expect(outsideCount).toBe(2);
  });

  it('shows a semester that has not started as all future, and one that is over as all past', () => {
    const upcoming = buildSemesterGrid(range, new Map(), '2026-06-01').cells.filter(
      (c) => c.dateKey,
    );
    expect(upcoming.every((c) => c.phase === 'future')).toBe(true);
    const over = buildSemesterGrid(range, new Map(), '2027-02-01').cells.filter((c) => c.dateKey);
    expect(over.every((c) => c.phase === 'past')).toBe(true);
  });
});
