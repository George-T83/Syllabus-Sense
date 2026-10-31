import { describe, it, expect } from 'vitest';
import {
  addDaysToDayKey,
  describeSkippedChunks,
  normalizeSuggestedChunk,
  resolveStudentToday,
} from '../suggestedChunks';

const TYPES = new Set(['assignment', 'project', 'other']);

describe('addDaysToDayKey', () => {
  it('rolls over months, years and leap days without time-zone drift', () => {
    expect(addDaysToDayKey('2026-10-25', 7)).toBe('2026-11-01');
    expect(addDaysToDayKey('2026-12-30', 3)).toBe('2027-01-02');
    expect(addDaysToDayKey('2028-02-28', 1)).toBe('2028-02-29');
    // Across the US fall-back DST change.
    expect(addDaysToDayKey('2026-11-01', 1)).toBe('2026-11-02');
  });

  it('refuses impossible dates and absurd offsets', () => {
    expect(addDaysToDayKey('2026-02-31', 1)).toBeNull();
    expect(addDaysToDayKey('nope', 1)).toBeNull();
    expect(addDaysToDayKey('2026-10-25', 1e15)).toBeNull();
  });
});

describe('resolveStudentToday', () => {
  const now = new Date('2026-10-26T02:00:00Z');

  it("uses the student's day when it is within a day of the server's", () => {
    expect(resolveStudentToday('2026-10-25', now)).toBe('2026-10-25');
    expect(resolveStudentToday('2026-10-27', now)).toBe('2026-10-27');
  });

  it('ignores unusable input and falls back to the server UTC day', () => {
    for (const bad of [undefined, null, 5, '', '10/25/2026', '2026-02-31', '2026-10-20']) {
      expect(resolveStudentToday(bad, now)).toBe('2026-10-26');
    }
  });
});

describe('normalizeSuggestedChunk', () => {
  it('keeps an explicit zero offset on the same day', () => {
    const result = normalizeSuggestedChunk(
      { title: 'a', dueDateOffsetDays: 0 },
      '2026-10-25',
      TYPES,
    );
    expect(result).toMatchObject({ chunk: { dueDate: '2026-10-25' } });
  });

  it('accepts numeric strings and rounds fractional offsets', () => {
    const result = normalizeSuggestedChunk(
      { title: 'a', dueDateOffsetDays: '2.4', estimatedHours: '1.5' },
      '2026-10-25',
      TYPES,
    );
    expect(result).toMatchObject({ chunk: { dueDate: '2026-10-27', estimatedHours: 1.5 } });
  });

  it('skips negative offsets, negative hours, and offsets past the limit', () => {
    for (const bad of [
      { dueDateOffsetDays: -1 },
      { dueDateOffsetDays: 366 },
      { dueDateOffsetDays: 1e15 },
      { estimatedHours: -0.5 },
      { estimatedHours: 5000 },
    ]) {
      expect(normalizeSuggestedChunk({ title: 'x', ...bad }, '2026-10-25', TYPES)).toHaveProperty(
        'skipped',
      );
    }
  });

  it('treats a non-object entry as an untitled default step rather than throwing', () => {
    expect(normalizeSuggestedChunk(null, '2026-10-25', TYPES)).toMatchObject({
      chunk: { title: 'Subtask', dueDate: '2026-10-26', estimatedHours: 1, type: 'other' },
    });
  });
});

describe('describeSkippedChunks', () => {
  it('is empty when nothing was skipped and names each skipped step otherwise', () => {
    expect(describeSkippedChunks([])).toBe('');
    expect(describeSkippedChunks([{ title: 'A', reason: 'its due date was before today' }])).toBe(
      '_Skipped 1 suggested task: "A" (its due date was before today)._',
    );
  });
});
