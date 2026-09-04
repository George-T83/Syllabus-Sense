import { describe, it, expect } from 'vitest';
import {
  computeMoodStreak,
  computeAverageMood,
  computeMoodByWorkloadLevel,
  computeMoodTrend,
  computeBestAndWorstDay,
  sortMoodEntries,
} from '../moodStats';
import type { MoodEntry, MoodValue } from '@/types/mood';
import type { ScheduleItem } from '@/types/schedule';

function entry(dateKey: string, mood: MoodValue): MoodEntry {
  return { id: dateKey, dateKey, mood, createdAt: `${dateKey}T12:00:00.000Z` };
}

function item(dueDate: string, hours: number): ScheduleItem {
  return {
    id: `${dueDate}-${hours}`,
    courseId: 'c1',
    title: 'Test item',
    type: 'assignment',
    dueDate,
    estimatedHours: hours,
    completed: false,
  } as ScheduleItem;
}

describe('sortMoodEntries', () => {
  it('sorts oldest to newest', () => {
    const sorted = sortMoodEntries([entry('2026-09-03', 3), entry('2026-09-01', 2)]);
    expect(sorted.map((e) => e.dateKey)).toEqual(['2026-09-01', '2026-09-03']);
  });
});

describe('computeMoodStreak', () => {
  it('counts consecutive check-ins ending today', () => {
    const entries = [entry('2026-09-01', 3), entry('2026-09-02', 4), entry('2026-09-03', 3)];
    expect(computeMoodStreak(entries, new Date(2026, 8, 3))).toBe(3);
  });

  it('does not reset just because today has no check-in yet', () => {
    const entries = [entry('2026-09-01', 3), entry('2026-09-02', 4)];
    expect(computeMoodStreak(entries, new Date(2026, 8, 3))).toBe(2);
  });

  it('stops at the first gap', () => {
    const entries = [entry('2026-08-30', 2), entry('2026-09-02', 4), entry('2026-09-03', 3)];
    expect(computeMoodStreak(entries, new Date(2026, 8, 3))).toBe(2);
  });

  it('is zero with no check-ins at all', () => {
    expect(computeMoodStreak([], new Date(2026, 8, 3))).toBe(0);
  });
});

describe('computeAverageMood', () => {
  it('averages mood values', () => {
    expect(computeAverageMood([entry('2026-09-01', 2), entry('2026-09-02', 4)])).toBe(3);
  });

  it('returns null with no entries, not NaN or 0', () => {
    expect(computeAverageMood([])).toBeNull();
  });
});

describe('computeMoodByWorkloadLevel', () => {
  it('buckets check-ins by that day due-hours level and averages mood within each', () => {
    const entries = [
      entry('2026-09-01', 4), // 0h due -> low
      entry('2026-09-02', 1), // 8h due -> critical
      entry('2026-09-03', 3), // 2h due -> low
    ];
    const items = [item('2026-09-02', 8)];
    const buckets = computeMoodByWorkloadLevel(entries, items);

    const low = buckets.find((b) => b.level === 'low')!;
    expect(low.count).toBe(2);
    expect(low.averageMood).toBe(3.5);

    const critical = buckets.find((b) => b.level === 'critical')!;
    expect(critical.count).toBe(1);
    expect(critical.averageMood).toBe(1);

    const medium = buckets.find((b) => b.level === 'medium')!;
    expect(medium.count).toBe(0);
    expect(medium.averageMood).toBeNull();
  });

  it('always returns all four levels even with zero entries', () => {
    const buckets = computeMoodByWorkloadLevel([], []);
    expect(buckets.map((b) => b.level)).toEqual(['low', 'medium', 'high', 'critical']);
    expect(buckets.every((b) => b.count === 0 && b.averageMood === null)).toBe(true);
  });
});

describe('computeMoodTrend', () => {
  it('returns a sorted, chart-ready series', () => {
    const trend = computeMoodTrend([entry('2026-09-02', 4), entry('2026-09-01', 2)]);
    expect(trend).toEqual([
      { dateKey: '2026-09-01', mood: 2 },
      { dateKey: '2026-09-02', mood: 4 },
    ]);
  });
});

describe('computeBestAndWorstDay', () => {
  it('finds the highest and lowest mood day', () => {
    const entries = [entry('2026-09-01', 2), entry('2026-09-02', 4), entry('2026-09-03', 1)];
    const { best, worst } = computeBestAndWorstDay(entries);
    expect(best).toEqual({ dateKey: '2026-09-02', mood: 4 });
    expect(worst).toEqual({ dateKey: '2026-09-03', mood: 1 });
  });

  it('breaks ties toward the more recent day', () => {
    const entries = [entry('2026-09-01', 4), entry('2026-09-05', 4)];
    const { best } = computeBestAndWorstDay(entries);
    expect(best).toEqual({ dateKey: '2026-09-05', mood: 4 });
  });

  it('returns nulls with no entries', () => {
    expect(computeBestAndWorstDay([])).toEqual({ best: null, worst: null });
  });
});
