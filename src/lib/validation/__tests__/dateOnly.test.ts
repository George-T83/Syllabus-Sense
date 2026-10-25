import { describe, it, expect } from 'vitest';
import { isPlausibleDueDate, isRealCalendarDate } from '../dateOnly';
import { scheduleItemFormSchema } from '../scheduleItem';
import { extractedScheduleItemSchema } from '@/types/extraction';

describe('isRealCalendarDate', () => {
  it('accepts real days, including a leap day', () => {
    expect(isRealCalendarDate('2026-02-28')).toBe(true);
    expect(isRealCalendarDate('2028-02-29')).toBe(true);
  });

  it('rejects days the calendar rolls over', () => {
    expect(isRealCalendarDate('2026-02-31')).toBe(false);
    expect(isRealCalendarDate('2027-02-29')).toBe(false);
    expect(isRealCalendarDate('2026-04-31')).toBe(false);
    expect(isRealCalendarDate('2026-13-01')).toBe(false);
    expect(isRealCalendarDate('2026-00-10')).toBe(false);
    expect(isRealCalendarDate('2026-01-00')).toBe(false);
  });

  it('rejects malformed text', () => {
    expect(isRealCalendarDate('')).toBe(false);
    expect(isRealCalendarDate('sometime in October')).toBe(false);
    expect(isRealCalendarDate('2026-2-3')).toBe(false);
  });
});

describe('isPlausibleDueDate', () => {
  it('limits the year to 1990-2100', () => {
    expect(isPlausibleDueDate('2026-12-01')).toBe(true);
    expect(isPlausibleDueDate('2020-01-01')).toBe(true);
    expect(isPlausibleDueDate('9999-12-31')).toBe(false);
    expect(isPlausibleDueDate('0001-01-01')).toBe(false);
  });
});

const base = {
  title: 'Essay',
  type: 'assignment' as const,
  courseId: 'c1',
  priority: 'medium' as const,
};

describe('task form due date', () => {
  it('accepts a normal date', () => {
    expect(scheduleItemFormSchema.safeParse({ ...base, dueDate: '2026-12-01' }).success).toBe(true);
  });

  it('rejects a rollover date and a year-9999 date with a readable message', () => {
    for (const dueDate of ['2026-02-31', '9999-12-31']) {
      const result = scheduleItemFormSchema.safeParse({ ...base, dueDate });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Enter a real date between 1990 and 2100');
      }
    }
  });
});

describe('extracted item due date', () => {
  const item = { title: 'Midterm', type: 'exam', dateConfidence: 'exact' };

  it('keeps a real date and a null date', () => {
    expect(extractedScheduleItemSchema.safeParse({ ...item, dueDate: '2026-10-05' }).success).toBe(
      true,
    );
    expect(extractedScheduleItemSchema.safeParse({ ...item, dueDate: null }).success).toBe(true);
  });

  it('rejects 2026-02-31 so the review step flags the item instead of moving it to March 3', () => {
    expect(extractedScheduleItemSchema.safeParse({ ...item, dueDate: '2026-02-31' }).success).toBe(
      false,
    );
  });
});
