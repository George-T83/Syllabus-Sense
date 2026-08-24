import { describe, it, expect } from 'vitest';
import {
  toDayKey,
  parseDayKey,
  isSameDay,
  addDays,
  addMonths,
  getMonthGrid,
  getWeekDays,
  groupItemsByDay,
} from '@/lib/calendar/dates';
import type { ScheduleItem } from '@/types/schedule';

function item(id: string, dueDate: string): ScheduleItem {
  return { id, courseId: 'c1', title: id, type: 'assignment', dueDate, completed: false };
}

describe('toDayKey', () => {
  it('uses local date components, not UTC', () => {
    // Constructed from local components, so the key must match them regardless
    // of the runner's timezone. Using toISOString() here would shift the day
    // in any negative-UTC-offset zone.
    const lateNight = new Date(2026, 8, 1, 23, 59);
    expect(toDayKey(lateNight)).toBe('2026-09-01');
  });

  it('zero-pads single-digit months and days', () => {
    expect(toDayKey(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('isSameDay', () => {
  it('ignores time of day', () => {
    expect(isSameDay(new Date(2026, 8, 1, 0, 1), new Date(2026, 8, 1, 23, 59))).toBe(true);
  });

  it('distinguishes adjacent days', () => {
    expect(isSameDay(new Date(2026, 8, 1), new Date(2026, 8, 2))).toBe(false);
  });
});

describe('addDays', () => {
  it('rolls over month boundaries', () => {
    expect(toDayKey(addDays(new Date(2026, 8, 30), 1))).toBe('2026-10-01');
  });

  it('rolls over year boundaries', () => {
    expect(toDayKey(addDays(new Date(2026, 11, 31), 1))).toBe('2027-01-01');
  });

  it('handles leap day', () => {
    expect(toDayKey(addDays(new Date(2028, 1, 28), 1))).toBe('2028-02-29');
  });

  it('goes backward with negative values', () => {
    expect(toDayKey(addDays(new Date(2026, 8, 1), -1))).toBe('2026-08-31');
  });
});

describe('addMonths', () => {
  it('wraps into the next year', () => {
    expect(toDayKey(addMonths(new Date(2026, 11, 1), 1))).toBe('2027-01-01');
  });

  it('wraps into the previous year', () => {
    expect(toDayKey(addMonths(new Date(2026, 0, 1), -1))).toBe('2025-12-01');
  });
});

describe('getMonthGrid', () => {
  it('always returns 42 cells so the grid height never reflows', () => {
    expect(getMonthGrid(new Date(2026, 8, 1))).toHaveLength(42);
    expect(getMonthGrid(new Date(2026, 1, 1))).toHaveLength(42);
  });

  it('starts on the Sunday on or before the first of the month', () => {
    // Sep 1 2026 is a Tuesday, so the grid starts Sun Aug 30.
    const grid = getMonthGrid(new Date(2026, 8, 1));
    expect(grid[0].getDay()).toBe(0);
    expect(toDayKey(grid[0])).toBe('2026-08-30');
  });

  it('contains every day of the target month', () => {
    const grid = getMonthGrid(new Date(2026, 8, 1));
    const keys = grid.map(toDayKey);
    expect(keys).toContain('2026-09-01');
    expect(keys).toContain('2026-09-30');
  });

  it('covers a leap February correctly', () => {
    const keys = getMonthGrid(new Date(2028, 1, 1)).map(toDayKey);
    expect(keys).toContain('2028-02-29');
    expect(keys).not.toContain('2028-02-30');
  });
});

describe('getWeekDays', () => {
  it('returns 7 days starting on Sunday', () => {
    const week = getWeekDays(new Date(2026, 8, 2)); // a Wednesday
    expect(week).toHaveLength(7);
    expect(week[0].getDay()).toBe(0);
    expect(toDayKey(week[0])).toBe('2026-08-30');
    expect(toDayKey(week[6])).toBe('2026-09-05');
  });
});

describe('groupItemsByDay', () => {
  it('buckets multiple items due the same day together', () => {
    const grouped = groupItemsByDay([
      item('a', new Date(2026, 8, 1, 9).toISOString()),
      item('b', new Date(2026, 8, 1, 17).toISOString()),
      item('c', new Date(2026, 8, 2, 9).toISOString()),
    ]);
    expect(grouped.get('2026-09-01')?.map((i) => i.id)).toEqual(['a', 'b']);
    expect(grouped.get('2026-09-02')?.map((i) => i.id)).toEqual(['c']);
  });

  it('returns an empty map for no items', () => {
    expect(groupItemsByDay([]).size).toBe(0);
  });

  it('buckets a late-night due time on its local day, not the next one', () => {
    const grouped = groupItemsByDay([item('late', new Date(2026, 8, 1, 23, 59).toISOString())]);
    expect(grouped.has('2026-09-01')).toBe(true);
    expect(grouped.has('2026-09-02')).toBe(false);
  });

  it('buckets bare date strings directly without UTC shift', () => {
    const grouped = groupItemsByDay([
      item('bare-1', '2026-08-25'),
      item('bare-2', '2026-08-25'),
      item('bare-3', '2026-12-31'),
    ]);
    expect(grouped.get('2026-08-25')?.length).toBe(2);
    expect(grouped.get('2026-12-31')?.length).toBe(1);
  });
});

describe('parseDayKey', () => {
  it('parses YYYY-MM-DD into a local Date without UTC shift', () => {
    const parsed = parseDayKey('2026-08-25');
    expect(parsed.getFullYear()).toBe(2026);
    expect(parsed.getMonth()).toBe(7); // August is 0-indexed 7
    expect(parsed.getDate()).toBe(25);
  });

  it('handles year transitions', () => {
    const parsed = parseDayKey('2027-01-01');
    expect(parsed.getFullYear()).toBe(2027);
    expect(parsed.getMonth()).toBe(0);
    expect(parsed.getDate()).toBe(1);
  });
});

