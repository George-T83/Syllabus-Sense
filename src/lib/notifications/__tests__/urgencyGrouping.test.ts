import { describe, it, expect } from 'vitest';
import {
  groupByUrgency,
  DUE_TODAY_WINDOW_MS,
  DUE_THIS_WEEK_WINDOW_MS,
  HIGH_STAKES_WINDOW_MS,
} from '../urgencyGrouping';
import type { ScheduleItem } from '@/types/schedule';

const NOW = new Date('2026-09-24T12:00:00.000Z').getTime();

function makeItem(
  overrides: Partial<ScheduleItem> & { id: string; dueDate: string },
): ScheduleItem {
  return {
    courseId: 'course-1',
    title: `Item ${overrides.id}`,
    type: 'assignment',
    completed: false,
    ...overrides,
  } as ScheduleItem;
}

describe('groupByUrgency', () => {
  it('buckets a past-due item as overdue regardless of grade weight', () => {
    const item = makeItem({ id: '1', dueDate: new Date(NOW - 60_000).toISOString() });
    const result = groupByUrgency([item], NOW);
    expect(result.overdue).toEqual([item]);
    expect(result.dueToday).toEqual([]);
  });

  it('buckets an item due within the next 24 hours as due today', () => {
    const item = makeItem({
      id: '1',
      dueDate: new Date(NOW + DUE_TODAY_WINDOW_MS - 1000).toISOString(),
    });
    const result = groupByUrgency([item], NOW);
    expect(result.dueToday).toEqual([item]);
  });

  it('buckets an item due within the week (but not today) as due this week', () => {
    const item = makeItem({
      id: '1',
      dueDate: new Date(NOW + DUE_TODAY_WINDOW_MS + 1000).toISOString(),
    });
    const result = groupByUrgency([item], NOW);
    expect(result.dueThisWeek).toEqual([item]);
  });

  it('does not surface a low-weight item due beyond this week', () => {
    const item = makeItem({
      id: '1',
      dueDate: new Date(NOW + DUE_THIS_WEEK_WINDOW_MS + 1000).toISOString(),
      gradeWeight: 5,
    });
    const result = groupByUrgency([item], NOW);
    expect(result.highStakesAhead).toEqual([]);
    expect(result.dueThisWeek).toEqual([]);
  });

  it('surfaces a high-weight item due beyond this week but within the high-stakes window', () => {
    const item = makeItem({
      id: '1',
      dueDate: new Date(NOW + DUE_THIS_WEEK_WINDOW_MS + 1000).toISOString(),
      gradeWeight: 40,
    });
    const result = groupByUrgency([item], NOW);
    expect(result.highStakesAhead).toEqual([item]);
  });

  it('does not surface a high-weight item beyond the high-stakes window', () => {
    const item = makeItem({
      id: '1',
      dueDate: new Date(NOW + HIGH_STAKES_WINDOW_MS + 1000).toISOString(),
      gradeWeight: 100,
    });
    const result = groupByUrgency([item], NOW);
    expect(result.highStakesAhead).toEqual([]);
  });

  it('treats a high-weight item due this week as due-this-week, not duplicated into high-stakes-ahead', () => {
    const item = makeItem({
      id: '1',
      dueDate: new Date(NOW + DUE_TODAY_WINDOW_MS + 1000).toISOString(),
      gradeWeight: 40,
    });
    const result = groupByUrgency([item], NOW);
    expect(result.dueThisWeek).toEqual([item]);
    expect(result.highStakesAhead).toEqual([]);
  });

  it('excludes completed items from every bucket', () => {
    const item = makeItem({
      id: '1',
      dueDate: new Date(NOW - 60_000).toISOString(),
      completed: true,
    });
    const result = groupByUrgency([item], NOW);
    expect(result.overdue).toEqual([]);
  });

  it('sorts each bucket by ascending due date', () => {
    const later = makeItem({ id: 'later', dueDate: new Date(NOW - 1000).toISOString() });
    const earlier = makeItem({ id: 'earlier', dueDate: new Date(NOW - 5000).toISOString() });
    const result = groupByUrgency([later, earlier], NOW);
    expect(result.overdue.map((i) => i.id)).toEqual(['earlier', 'later']);
  });

  it('treats a missing gradeWeight as 0 for high-stakes eligibility', () => {
    const item = makeItem({
      id: '1',
      dueDate: new Date(NOW + DUE_THIS_WEEK_WINDOW_MS + 1000).toISOString(),
    });
    const result = groupByUrgency([item], NOW);
    expect(result.highStakesAhead).toEqual([]);
  });
});
