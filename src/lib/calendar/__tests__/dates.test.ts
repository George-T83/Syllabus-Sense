import { afterAll, beforeAll, describe, it, expect } from 'vitest';
import {
  daysUntilDue,
  dueInstant,
  eachDayOfRange,
  isOverdue,
  parseDayKey,
  toDayKey,
} from '../dates';

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

// Due dates west of UTC: the case the container's UTC clock hides. A bare
// "2026-09-26" used to parse as midnight UTC - 8pm the evening before in
// New York - so work due today read as overdue all day.
describe('due dates in a negative-UTC-offset zone', () => {
  const originalTZ = process.env.TZ;
  beforeAll(() => {
    process.env.TZ = 'America/New_York';
  });
  afterAll(() => {
    process.env.TZ = originalTZ;
  });

  // 9am Saturday Sep 26 in New York.
  const morning = () => new Date(2026, 8, 26, 9, 0);

  it('does not call a bare date due today overdue', () => {
    expect(isOverdue({ completed: false, dueDate: '2026-09-26' }, morning())).toBe(false);
    expect(
      isOverdue({ completed: false, dueDate: '2026-09-26' }, new Date(2026, 8, 26, 23, 30)),
    ).toBe(false);
  });

  it('calls it overdue once the day is over', () => {
    expect(isOverdue({ completed: false, dueDate: '2026-09-25' }, morning())).toBe(true);
    expect(
      isOverdue({ completed: false, dueDate: '2026-09-26' }, new Date(2026, 8, 27, 0, 1)),
    ).toBe(true);
  });

  it('keeps an explicit time: due 23:59 local, saved as the next day in UTC', () => {
    const dueDate = new Date(2026, 8, 26, 23, 59).toISOString(); // 2026-09-27T03:59:00.000Z
    expect(dueDate.startsWith('2026-09-27')).toBe(true);
    expect(isOverdue({ completed: false, dueDate }, morning())).toBe(false);
    expect(daysUntilDue(dueDate, morning())).toBe(0);
    expect(toDayKey(dueDate)).toBe('2026-09-26');
  });

  it('never calls finished work overdue', () => {
    expect(isOverdue({ completed: true, dueDate: '2026-09-01' }, morning())).toBe(false);
  });

  it('counts days by the local calendar', () => {
    expect(daysUntilDue('2026-09-26', morning())).toBe(0);
    expect(daysUntilDue('2026-09-27', morning())).toBe(1);
    expect(daysUntilDue('2026-09-24', new Date(2026, 8, 26, 23, 59))).toBe(-2);
  });

  it('reads a bare date as the end of that local day', () => {
    const end = dueInstant('2026-09-26');
    expect([end.getDate(), end.getHours(), end.getMinutes()]).toEqual([26, 23, 59]);
    expect(parseDayKey('2026-09-26').getDate()).toBe(26);
  });
});
