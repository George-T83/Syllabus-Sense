import { describe, it, expect } from 'vitest';
import { eachDayOfRange, toDayKey } from '../dates';

describe('eachDayOfRange', () => {
  it('returns every day inclusive of both endpoints', () => {
    const start = new Date(2026, 8, 1); // Sep 1, 2026 (local)
    const end = new Date(2026, 8, 4); // Sep 4, 2026 (local)
    const days = eachDayOfRange(start, end).map(toDayKey);
    expect(days).toEqual(['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04']);
  });

  it('returns a single day when start equals end', () => {
    const day = new Date(2026, 8, 1);
    expect(eachDayOfRange(day, day).map(toDayKey)).toEqual(['2026-09-01']);
  });

  it('returns an empty array when start is after end', () => {
    const start = new Date(2026, 8, 5);
    const end = new Date(2026, 8, 1);
    expect(eachDayOfRange(start, end)).toEqual([]);
  });

  it('walks across a month boundary correctly', () => {
    const start = new Date(2026, 8, 29); // Sep 29
    const end = new Date(2026, 9, 2); // Oct 2
    expect(eachDayOfRange(start, end).map(toDayKey)).toEqual([
      '2026-09-29',
      '2026-09-30',
      '2026-10-01',
      '2026-10-02',
    ]);
  });

  it('normalizes a non-midnight start time to the start of that day', () => {
    const start = new Date(2026, 8, 1, 23, 45);
    const end = new Date(2026, 8, 2, 0, 0);
    expect(eachDayOfRange(start, end).map(toDayKey)).toEqual(['2026-09-01', '2026-09-02']);
  });
});
