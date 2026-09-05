import { describe, it, expect } from 'vitest';
import { computeBurnoutRisk } from '../burnoutRisk';
import type { ScheduleItem } from '@/types/schedule';
import type { MoodEntry } from '@/types/mood';

const REFERENCE_DATE = new Date(2026, 8, 10); // Thursday, September 10, 2026

function item(overrides: Partial<ScheduleItem> & { dueDate: string }): ScheduleItem {
  return {
    id: overrides.id ?? `item-${overrides.dueDate}-${Math.random()}`,
    courseId: 'course-1',
    title: 'Item',
    type: 'assignment',
    completed: false,
    ...overrides,
  };
}

function mood(dateKey: string, value: MoodEntry['mood']): MoodEntry {
  return { id: dateKey, dateKey, mood: value, createdAt: `${dateKey}T12:00:00.000Z` };
}

describe('computeBurnoutRisk', () => {
  it('reports low risk with no factors when there is no data at all', () => {
    const result = computeBurnoutRisk([], [], REFERENCE_DATE);
    expect(result.level).toBe('low');
    expect(result.score).toBe(0);
    expect(result.factors).toEqual([]);
    expect(result.hasEnoughMoodData).toBe(false);
  });

  it('flags overdue items as a factor and raises the level once enough of them pile up', () => {
    const items: ScheduleItem[] = [
      item({ id: 'a', dueDate: '2026-09-07' }),
      item({ id: 'b', dueDate: '2026-09-08' }),
      item({ id: 'c', dueDate: '2026-09-09' }),
    ];
    const result = computeBurnoutRisk(items, [], REFERENCE_DATE);
    const overdueFactor = result.factors.find((f) => f.key === 'overdue');
    expect(overdueFactor?.label).toBe('3 overdue items');
    expect(overdueFactor?.points).toBe(24);
    expect(result.level).toBe('medium');
  });

  it('does not count a completed item as overdue', () => {
    const items: ScheduleItem[] = [item({ dueDate: '2026-09-01', completed: true })];
    const result = computeBurnoutRisk(items, [], REFERENCE_DATE);
    expect(result.factors.find((f) => f.key === 'overdue')).toBeUndefined();
  });

  it('flags a heavy stretch of upcoming days', () => {
    const items: ScheduleItem[] = [
      item({ id: 'crit-1', dueDate: '2026-09-11', estimatedHours: 9 }),
      item({ id: 'crit-2', dueDate: '2026-09-12', estimatedHours: 9 }),
    ];
    const result = computeBurnoutRisk(items, [], REFERENCE_DATE);
    const upcomingFactor = result.factors.find((f) => f.key === 'upcoming-load');
    expect(upcomingFactor?.label).toBe('2 heavy days coming up in the next week');
    expect(upcomingFactor?.points).toBe(14); // 2 critical days x 7 points
  });

  it('flags a heavy recent stretch using due-date load regardless of completion', () => {
    const items: ScheduleItem[] = [
      item({ id: 'past-1', dueDate: '2026-09-05', estimatedHours: 6, completed: true }),
      item({ id: 'past-2', dueDate: '2026-09-06', estimatedHours: 6, completed: true }),
    ];
    const result = computeBurnoutRisk(items, [], REFERENCE_DATE);
    const recentFactor = result.factors.find((f) => f.key === 'recent-load');
    expect(recentFactor?.label).toBe('2 heavy days over the past week');
    expect(recentFactor?.points).toBe(6); // 2 high days x 3 points
    expect(result.factors.find((f) => f.key === 'overdue')).toBeUndefined();
  });

  it('reports insufficient mood data below the minimum check-in threshold', () => {
    const entries = [mood('2026-09-09', 1), mood('2026-09-10', 1)];
    const result = computeBurnoutRisk([], entries, REFERENCE_DATE);
    expect(result.hasEnoughMoodData).toBe(false);
    expect(result.factors.find((f) => f.key === 'low-mood')).toBeUndefined();
  });

  it('flags a low mood average once enough check-ins are logged', () => {
    const entries = [
      mood('2026-09-06', 1),
      mood('2026-09-07', 1),
      mood('2026-09-08', 2),
      mood('2026-09-09', 1),
      mood('2026-09-10', 1),
    ];
    const result = computeBurnoutRisk([], entries, REFERENCE_DATE);
    expect(result.hasEnoughMoodData).toBe(true);
    const moodFactor = result.factors.find((f) => f.key === 'low-mood');
    expect(moodFactor?.label).toBe('Average mood has been low this week (1.2/4)');
    expect(moodFactor?.points).toBe(20);
  });

  it('flags a declining mood trend within the week separately from the average', () => {
    const entries = [
      mood('2026-09-06', 4),
      mood('2026-09-07', 4),
      mood('2026-09-08', 2),
      mood('2026-09-09', 2),
      mood('2026-09-10', 2),
    ];
    const result = computeBurnoutRisk([], entries, REFERENCE_DATE);
    expect(result.factors.find((f) => f.key === 'declining-mood')?.points).toBe(10);
  });

  it('escalates to critical when multiple strong signals stack up', () => {
    const items: ScheduleItem[] = [
      item({ id: 'od-1', dueDate: '2026-09-07' }),
      item({ id: 'od-2', dueDate: '2026-09-08' }),
      item({ id: 'od-3', dueDate: '2026-09-09' }),
      item({ id: 'od-4', dueDate: '2026-09-09' }),
      item({ id: 'crit-1', dueDate: '2026-09-11', estimatedHours: 9 }),
      item({ id: 'crit-2', dueDate: '2026-09-12', estimatedHours: 9 }),
      item({ id: 'crit-3', dueDate: '2026-09-13', estimatedHours: 9 }),
    ];
    const entries = [
      mood('2026-09-06', 1),
      mood('2026-09-07', 1),
      mood('2026-09-08', 1),
      mood('2026-09-09', 1),
    ];
    const result = computeBurnoutRisk(items, entries, REFERENCE_DATE);
    expect(result.level).toBe('critical');
  });

  it('sorts factors highest-points first', () => {
    const items: ScheduleItem[] = [
      item({ id: 'od-1', dueDate: '2026-09-07' }),
      item({ id: 'crit-1', dueDate: '2026-09-11', estimatedHours: 9 }),
      item({ id: 'crit-2', dueDate: '2026-09-12', estimatedHours: 9 }),
      item({ id: 'crit-3', dueDate: '2026-09-13', estimatedHours: 9 }),
      item({ id: 'crit-4', dueDate: '2026-09-14', estimatedHours: 9 }),
    ];
    const result = computeBurnoutRisk(items, [], REFERENCE_DATE);
    const points = result.factors.map((f) => f.points);
    expect(points).toEqual([...points].sort((a, b) => b - a));
  });
});
