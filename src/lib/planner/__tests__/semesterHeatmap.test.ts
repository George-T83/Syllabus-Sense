import { describe, it, expect } from 'vitest';
import { computeSemesterHeatmap } from '../semesterHeatmap';
import type { ScheduleItem } from '@/types/schedule';

function item(overrides: Partial<ScheduleItem> & Pick<ScheduleItem, 'dueDate'>): ScheduleItem {
  return {
    id: overrides.id ?? `item-${Math.random()}`,
    courseId: 'course-1',
    title: 'Test item',
    type: 'assignment',
    completed: false,
    ...overrides,
  };
}

describe('computeSemesterHeatmap', () => {
  it('returns an empty array when there are no dated items', () => {
    expect(computeSemesterHeatmap([])).toEqual([]);
  });

  it('spans from the earliest to the latest due date, filling gap days with zero hours', () => {
    const days = computeSemesterHeatmap([
      item({ dueDate: '2026-09-01', estimatedHours: 1 }),
      item({ dueDate: '2026-09-04', estimatedHours: 1 }),
    ]);
    expect(days.map((d) => d.dateKey)).toEqual([
      '2026-09-01',
      '2026-09-02',
      '2026-09-03',
      '2026-09-04',
    ]);
    expect(days[1].hours).toBe(0);
    expect(days[1].level).toBe('low');
  });

  it('sums multiple items due the same day', () => {
    const days = computeSemesterHeatmap([
      item({ dueDate: '2026-09-01', estimatedHours: 2 }),
      item({ dueDate: '2026-09-01', estimatedHours: 3 }),
    ]);
    expect(days).toHaveLength(1);
    expect(days[0].hours).toBe(5);
    expect(days[0].level).toBe('medium');
  });

  it('defaults an exam with no estimatedHours to 2 hours and everything else to 1', () => {
    const days = computeSemesterHeatmap([
      item({ dueDate: '2026-09-01', type: 'exam' }),
      item({ dueDate: '2026-09-02', type: 'assignment' }),
    ]);
    expect(days[0].hours).toBe(2);
    expect(days[1].hours).toBe(1);
  });

  it('counts a completed item toward its due date the same as an incomplete one', () => {
    const days = computeSemesterHeatmap([
      item({ dueDate: '2026-09-01', estimatedHours: 4, completed: true }),
    ]);
    expect(days[0].hours).toBe(4);
  });

  it('ignores items with no due date', () => {
    const days = computeSemesterHeatmap([
      item({ dueDate: '', estimatedHours: 4 }),
      item({ dueDate: '2026-09-01', estimatedHours: 1 }),
    ]);
    expect(days).toHaveLength(1);
    expect(days[0].dateKey).toBe('2026-09-01');
  });
});
