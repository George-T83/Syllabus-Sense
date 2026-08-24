import { describe, it, expect } from 'vitest';
import {
  toDateOnly,
  formatDateISO,
  isWithinSemesterRange,
  getSemesterDaysRemaining,
  isSemesterTransitionWindow,
} from '@/lib/workload/dateUtils';
import { toDayKey, parseDayKey, isSameDay } from '@/lib/calendar/dates';

describe('Date & Timezone Key Defense (Item 07)', () => {
  describe('toDateOnly', () => {
    it('parses bare YYYY-MM-DD strings without any timezone drift', () => {
      const d1 = toDateOnly('2026-08-25');
      expect(formatDateISO(d1)).toBe('2026-08-25');

      const d2 = toDateOnly('2026-12-31');
      expect(formatDateISO(d2)).toBe('2026-12-31');

      const d3 = toDateOnly('2028-02-29'); // Leap year
      expect(formatDateISO(d3)).toBe('2028-02-29');
    });

    it('parses full ISO strings retaining the user calendar date', () => {
      const lateNight = new Date(2026, 7, 25, 23, 59, 0).toISOString();
      const d = toDateOnly(lateNight);
      expect(formatDateISO(d)).toBe('2026-08-25');
    });

    it('falls back gracefully on invalid date string', () => {
      const d = toDateOnly('invalid-date');
      expect(d).toBeInstanceOf(Date);
      expect(isNaN(d.getTime())).toBe(false);
    });
  });

  describe('Semester Transition Utilities', () => {
    it('accurately verifies if a date is within semester range', () => {
      const start = '2026-08-24';
      const end = '2026-12-18';

      expect(isWithinSemesterRange('2026-08-24', start, end)).toBe(true);
      expect(isWithinSemesterRange('2026-10-15', start, end)).toBe(true);
      expect(isWithinSemesterRange('2026-12-18', start, end)).toBe(true);
      expect(isWithinSemesterRange('2026-08-20', start, end)).toBe(false);
      expect(isWithinSemesterRange('2026-12-25', start, end)).toBe(false);
    });

    it('computes days remaining in semester without negative drift', () => {
      const end = '2026-12-18';
      expect(getSemesterDaysRemaining('2026-12-10', end)).toBe(8);
      expect(getSemesterDaysRemaining('2026-12-18', end)).toBe(0);
      expect(getSemesterDaysRemaining('2026-12-25', end)).toBe(0);
    });

    it('identifies semester transition windows', () => {
      const boundary = '2026-08-24';
      expect(isSemesterTransitionWindow('2026-08-20', boundary, 7)).toBe(true);
      expect(isSemesterTransitionWindow('2026-08-30', boundary, 7)).toBe(true);
      expect(isSemesterTransitionWindow('2026-09-15', boundary, 7)).toBe(false);
    });
  });

  describe('Calendar toDayKey & parseDayKey interoperability', () => {
    it('accepts string and Date seamlessly', () => {
      expect(toDayKey('2026-09-15')).toBe('2026-09-15');
      expect(toDayKey(new Date(2026, 8, 15))).toBe('2026-09-15');
    });

    it('parseDayKey handles dates and year boundaries', () => {
      const parsed = parseDayKey('2026-08-25');
      expect(parsed.getFullYear()).toBe(2026);
      expect(parsed.getMonth()).toBe(7);
      expect(parsed.getDate()).toBe(25);
    });

    it('isSameDay works across string and Date combinations', () => {
      expect(isSameDay('2026-09-15', new Date(2026, 8, 15))).toBe(true);
      expect(isSameDay(new Date(2026, 8, 15), '2026-09-15')).toBe(true);
      expect(isSameDay('2026-09-15', '2026-09-16')).toBe(false);
    });
  });
});
