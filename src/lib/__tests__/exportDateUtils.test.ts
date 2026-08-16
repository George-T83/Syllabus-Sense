import { describe, it, expect } from 'vitest';
import {
  getEventWindow,
  isDateOnly,
  formatUTCBasic,
  formatDateBasic,
} from '@/lib/export/dateUtils';

describe('isDateOnly', () => {
  it('recognizes bare YYYY-MM-DD strings', () => {
    expect(isDateOnly('2026-09-01')).toBe(true);
  });

  it('rejects full ISO timestamps', () => {
    expect(isDateOnly('2026-09-01T17:00:00.000Z')).toBe(false);
  });
});

describe('getEventWindow', () => {
  it('treats a bare date as an all-day event spanning to the next day', () => {
    const { start, end, allDay } = getEventWindow({ dueDate: '2026-09-01' });
    expect(allDay).toBe(true);
    expect(start.toISOString()).toBe('2026-09-01T00:00:00.000Z');
    expect(end.toISOString()).toBe('2026-09-02T00:00:00.000Z');
  });

  it('defaults to a 1-hour duration for timed events with no estimatedHours', () => {
    const { start, end, allDay } = getEventWindow({ dueDate: '2026-09-01T17:00:00.000Z' });
    expect(allDay).toBe(false);
    expect(end.getTime() - start.getTime()).toBe(60 * 60 * 1000);
  });

  it('uses estimatedHours to compute the duration', () => {
    const { start, end } = getEventWindow({
      dueDate: '2026-09-01T17:00:00.000Z',
      estimatedHours: 2.5,
    });
    expect(end.getTime() - start.getTime()).toBe(2.5 * 60 * 60 * 1000);
  });

  it('ignores a zero or negative estimatedHours and falls back to the default duration', () => {
    const { start, end } = getEventWindow({
      dueDate: '2026-09-01T17:00:00.000Z',
      estimatedHours: 0,
    });
    expect(end.getTime() - start.getTime()).toBe(60 * 60 * 1000);
  });

  it('throws on an unparseable dueDate', () => {
    expect(() => getEventWindow({ dueDate: 'not-a-date' })).toThrow();
  });
});

describe('formatUTCBasic / formatDateBasic', () => {
  it('formats a UTC timestamp as YYYYMMDDTHHMMSSZ', () => {
    expect(formatUTCBasic(new Date('2026-01-05T09:03:07.000Z'))).toBe('20260105T090307Z');
  });

  it('formats a UTC date as YYYYMMDD', () => {
    expect(formatDateBasic(new Date('2026-01-05T09:03:07.000Z'))).toBe('20260105');
  });
});
