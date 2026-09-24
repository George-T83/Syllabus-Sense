import { describe, it, expect } from 'vitest';
import { generateRecurringInstances } from '../recurringTaskTemplate';

describe('generateRecurringInstances', () => {
  it('generates weekly instances 7 days apart with no skip dates', () => {
    const result = generateRecurringInstances(
      '2026-09-07',
      { frequency: 'weekly', occurrences: 3 },
      [],
    );
    expect(result).toEqual([
      { dueDate: '2026-09-07', originalDate: '2026-09-07', shifted: false },
      { dueDate: '2026-09-14', originalDate: '2026-09-14', shifted: false },
      { dueDate: '2026-09-21', originalDate: '2026-09-21', shifted: false },
    ]);
  });

  it('generates biweekly instances 14 days apart', () => {
    const result = generateRecurringInstances(
      '2026-09-07',
      { frequency: 'biweekly', occurrences: 3 },
      [],
    );
    expect(result.map((i) => i.dueDate)).toEqual(['2026-09-07', '2026-09-21', '2026-10-05']);
  });

  it('shifts an instance forward one day off a single skip date', () => {
    const result = generateRecurringInstances(
      '2026-09-07',
      { frequency: 'weekly', occurrences: 2 },
      ['2026-09-14'],
    );
    expect(result[0]).toEqual({
      dueDate: '2026-09-07',
      originalDate: '2026-09-07',
      shifted: false,
    });
    expect(result[1]).toEqual({ dueDate: '2026-09-15', originalDate: '2026-09-14', shifted: true });
  });

  it('shifts past multiple consecutive skip dates to find the nearest open day', () => {
    const result = generateRecurringInstances(
      '2026-09-07',
      { frequency: 'weekly', occurrences: 1 },
      ['2026-09-07', '2026-09-08', '2026-09-09'],
    );
    expect(result[0]).toEqual({ dueDate: '2026-09-10', originalDate: '2026-09-07', shifted: true });
  });

  it('gives up after MAX_SHIFT_DAYS and uses the skip date rather than wandering indefinitely', () => {
    // A solid week of skip dates - every candidate within the search
    // window is blocked.
    const skipDates = [
      '2026-09-07',
      '2026-09-08',
      '2026-09-09',
      '2026-09-10',
      '2026-09-11',
      '2026-09-12',
      '2026-09-13',
    ];
    const result = generateRecurringInstances(
      '2026-09-07',
      { frequency: 'weekly', occurrences: 1 },
      skipDates,
    );
    // Still lands on a skip date (couldn't find an opening within 6 days),
    // but doesn't throw or run away - it stops at the search boundary.
    expect(result[0].dueDate).toBe('2026-09-13');
  });

  it('returns an empty array for zero or negative occurrences', () => {
    expect(
      generateRecurringInstances('2026-09-07', { frequency: 'weekly', occurrences: 0 }, []),
    ).toEqual([]);
    expect(
      generateRecurringInstances('2026-09-07', { frequency: 'weekly', occurrences: -1 }, []),
    ).toEqual([]);
  });

  it('normalizes skip dates given as full ISO timestamps, not just day keys', () => {
    const result = generateRecurringInstances(
      '2026-09-07',
      { frequency: 'weekly', occurrences: 1 },
      ['2026-09-07T23:59:00.000Z'],
    );
    expect(result[0].shifted).toBe(true);
  });
});
