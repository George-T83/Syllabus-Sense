import { describe, it, expect } from 'vitest';
import type { ScheduleItem } from '@/types/schedule';
import {
  ASSIGNMENT_TYPE_WEIGHT,
  DEFAULT_ESTIMATED_HOURS,
  getBaseEffectiveHours,
  applyStressFactor,
  getItemDailyDistribution,
  calculateDailyLoad,
  getWorkloadLevel,
  recommendStudyStartDate,
  WORKLOAD_LEVEL_THRESHOLDS,
} from '@/lib/workload';

const REFERENCE_DATE = '2026-08-16'; // fixed "today" for deterministic tests

function makeItem(overrides: Partial<ScheduleItem> = {}): ScheduleItem {
  return {
    id: 'item-1',
    courseId: 'course-1',
    title: 'Test item',
    type: 'assignment',
    dueDate: '2026-08-20',
    completed: false,
    ...overrides,
  };
}

describe('#49 workload formula matrix', () => {
  it('assigns exams a higher weight than readings', () => {
    expect(ASSIGNMENT_TYPE_WEIGHT.exam).toBeGreaterThan(ASSIGNMENT_TYPE_WEIGHT.reading);
  });

  it('defines a weight and default-hours entry for every assignment type', () => {
    const types: Array<keyof typeof ASSIGNMENT_TYPE_WEIGHT> = [
      'assignment',
      'exam',
      'quiz',
      'project',
      'reading',
      'other',
    ];
    for (const type of types) {
      expect(ASSIGNMENT_TYPE_WEIGHT[type]).toBeGreaterThan(0);
      expect(DEFAULT_ESTIMATED_HOURS[type]).toBeGreaterThan(0);
    }
  });
});

describe('#50 getBaseEffectiveHours', () => {
  it('uses estimatedHours when provided, weighted by type', () => {
    const item = makeItem({ type: 'exam', estimatedHours: 4 });
    expect(getBaseEffectiveHours(item)).toBeCloseTo(4 * ASSIGNMENT_TYPE_WEIGHT.exam);
  });

  it('falls back to the per-type default when estimatedHours is missing', () => {
    const item = makeItem({ type: 'reading', estimatedHours: undefined });
    expect(getBaseEffectiveHours(item)).toBeCloseTo(
      DEFAULT_ESTIMATED_HOURS.reading * ASSIGNMENT_TYPE_WEIGHT.reading,
    );
  });

  it('respects an explicit 0-hour estimate rather than falling back to the default', () => {
    const item = makeItem({ estimatedHours: 0 });
    expect(getBaseEffectiveHours(item)).toBe(0);
  });
});

describe('#52 applyStressFactor', () => {
  it('returns the same hours at moderate disposition and medium priority (both coefficients 1.0)', () => {
    expect(applyStressFactor(10, 'medium', 'moderate')).toBeCloseTo(10);
  });

  it('increases load for high stress disposition and high priority', () => {
    const boosted = applyStressFactor(10, 'high', 'high');
    expect(boosted).toBeGreaterThan(10);
  });

  it('decreases load for low stress disposition and low priority', () => {
    const reduced = applyStressFactor(10, 'low', 'low');
    expect(reduced).toBeLessThan(10);
  });

  it('treats a missing priority as medium', () => {
    expect(applyStressFactor(10, undefined, 'moderate')).toBeCloseTo(10);
  });
});

describe('#51 getItemDailyDistribution', () => {
  it('spreads hours evenly across the distribution window instead of dumping them on one day', () => {
    const item = makeItem({
      dueDate: '2026-08-20',
      estimatedHours: 10,
      type: 'assignment',
    });
    const distribution = getItemDailyDistribution(item, REFERENCE_DATE);
    expect(distribution.size).toBeGreaterThan(1);
    const values = [...distribution.values()];
    // Even split: every day should carry the same amount.
    for (const v of values) {
      expect(v).toBeCloseTo(values[0]);
    }
    const total = values.reduce((sum, v) => sum + v, 0);
    expect(total).toBeCloseTo(10);
  });

  it('caps the distribution window at maxDistributionDays', () => {
    const item = makeItem({ dueDate: '2026-10-01', estimatedHours: 14, type: 'assignment' });
    const distribution = getItemDailyDistribution(item, REFERENCE_DATE, { maxDistributionDays: 7 });
    expect(distribution.size).toBe(7);
  });

  it('places all hours on the due date when the item is due today', () => {
    const item = makeItem({ dueDate: REFERENCE_DATE, estimatedHours: 3 });
    const distribution = getItemDailyDistribution(item, REFERENCE_DATE);
    expect(distribution.size).toBe(1);
    expect(distribution.get(REFERENCE_DATE)).toBeCloseTo(3);
  });

  it('places all hours on the due date when the item is already overdue', () => {
    const item = makeItem({ dueDate: '2026-08-01', estimatedHours: 5 });
    const distribution = getItemDailyDistribution(item, REFERENCE_DATE);
    expect(distribution.size).toBe(1);
    expect(distribution.get('2026-08-01')).toBeCloseTo(5);
  });

  it('produces zero load for a zero-hour task without erroring', () => {
    const item = makeItem({ dueDate: '2026-08-22', estimatedHours: 0 });
    const distribution = getItemDailyDistribution(item, REFERENCE_DATE);
    for (const v of distribution.values()) {
      expect(v).toBe(0);
    }
  });
});

describe('#53/#56 calculateDailyLoad edge cases', () => {
  it('returns an empty map for an empty input array', () => {
    const result = calculateDailyLoad([], REFERENCE_DATE);
    expect(result.size).toBe(0);
  });

  it('excludes completed tasks from the load calculation entirely', () => {
    const completed = makeItem({
      id: 'a',
      dueDate: REFERENCE_DATE,
      estimatedHours: 100,
      completed: true,
    });
    const result = calculateDailyLoad([completed], REFERENCE_DATE);
    expect(result.size).toBe(0);
  });

  it('accumulates load from multiple overlapping deadlines on the same day rather than overwriting', () => {
    const itemA = makeItem({
      id: 'a',
      dueDate: REFERENCE_DATE,
      estimatedHours: 2,
      type: 'assignment',
    });
    const itemB = makeItem({
      id: 'b',
      dueDate: REFERENCE_DATE,
      estimatedHours: 3,
      type: 'assignment',
    });
    const itemC = makeItem({
      id: 'c',
      dueDate: REFERENCE_DATE,
      estimatedHours: 1,
      type: 'assignment',
    });
    const result = calculateDailyLoad([itemA, itemB, itemC], REFERENCE_DATE, {
      stressDisposition: 'moderate',
    });
    // All due today with medium(default) priority => stress coefficients are 1.0,
    // so the sum should be exactly the sum of weighted base hours.
    const expected = (2 + 3 + 1) * ASSIGNMENT_TYPE_WEIGHT.assignment;
    expect(result.get(REFERENCE_DATE)).toBeCloseTo(expected);
  });

  it('handles many overlapping deadlines on a single day without losing any contribution', () => {
    const items = Array.from({ length: 20 }, (_, i) =>
      makeItem({ id: `item-${i}`, dueDate: REFERENCE_DATE, estimatedHours: 1, type: 'reading' }),
    );
    const result = calculateDailyLoad(items, REFERENCE_DATE);
    expect(result.get(REFERENCE_DATE)).toBeCloseTo(20 * ASSIGNMENT_TYPE_WEIGHT.reading);
  });

  it('handles a task due in the past by attributing its load to the past due date, not today', () => {
    const item = makeItem({ dueDate: '2026-08-01', estimatedHours: 4 });
    const result = calculateDailyLoad([item], REFERENCE_DATE);
    expect(result.has(REFERENCE_DATE)).toBe(false);
    expect(result.get('2026-08-01')).toBeGreaterThan(0);
  });

  it('produces no NaN or negative values for a zero-hour task', () => {
    const item = makeItem({ dueDate: REFERENCE_DATE, estimatedHours: 0 });
    const result = calculateDailyLoad([item], REFERENCE_DATE);
    const val = result.get(REFERENCE_DATE) ?? 0;
    expect(Number.isNaN(val)).toBe(false);
    expect(val).toBeGreaterThanOrEqual(0);
  });
});

describe('#54 getWorkloadLevel thresholds', () => {
  it('classifies low load', () => {
    expect(getWorkloadLevel(0)).toBe('low');
    expect(getWorkloadLevel(WORKLOAD_LEVEL_THRESHOLDS.low)).toBe('low');
  });

  it('classifies medium load', () => {
    expect(getWorkloadLevel(WORKLOAD_LEVEL_THRESHOLDS.low + 0.01)).toBe('medium');
    expect(getWorkloadLevel(WORKLOAD_LEVEL_THRESHOLDS.medium)).toBe('medium');
  });

  it('classifies high load', () => {
    expect(getWorkloadLevel(WORKLOAD_LEVEL_THRESHOLDS.medium + 0.01)).toBe('high');
    expect(getWorkloadLevel(WORKLOAD_LEVEL_THRESHOLDS.high - 0.01)).toBe('high');
  });

  it('classifies critical (extreme) load at and above the high threshold', () => {
    expect(getWorkloadLevel(WORKLOAD_LEVEL_THRESHOLDS.high)).toBe('critical');
    expect(getWorkloadLevel(WORKLOAD_LEVEL_THRESHOLDS.high + 10)).toBe('critical');
  });

  it('never returns an invalid level for negative or extreme inputs', () => {
    const levels = ['low', 'medium', 'high', 'critical'];
    expect(levels).toContain(getWorkloadLevel(-5));
    expect(levels).toContain(getWorkloadLevel(1000));
  });
});

describe('#55 recommendStudyStartDate', () => {
  it('recommends starting on the due date when there is exactly one day of runway', () => {
    const item = makeItem({ dueDate: REFERENCE_DATE, estimatedHours: 2 });
    const rec = recommendStudyStartDate(item, REFERENCE_DATE);
    expect(rec.startDate).toBe(REFERENCE_DATE);
    expect(rec.overloaded).toBe(false);
  });

  it('recommends starting earlier when the due date is already saturated with other load', () => {
    const item = makeItem({ dueDate: '2026-08-18', estimatedHours: 4, type: 'assignment' });
    const existingLoad = new Map<string, number>([
      ['2026-08-18', WORKLOAD_LEVEL_THRESHOLDS.medium], // due date already at capacity
    ]);
    const rec = recommendStudyStartDate(item, REFERENCE_DATE, existingLoad);
    expect(rec.startDate < '2026-08-18').toBe(true);
    expect(rec.overloaded).toBe(false);
    const total = Object.values(rec.dailyAllocation).reduce((s, v) => s + v, 0);
    expect(total).toBeCloseTo(4 * ASSIGNMENT_TYPE_WEIGHT.assignment);
  });

  it('flags overloaded when even the full window cannot absorb the required hours', () => {
    const item = makeItem({ dueDate: REFERENCE_DATE, estimatedHours: 100 });
    const rec = recommendStudyStartDate(item, REFERENCE_DATE);
    expect(rec.overloaded).toBe(true);
  });

  it('flags overloaded and reports the due date for an already-overdue item', () => {
    const item = makeItem({ dueDate: '2026-08-01', estimatedHours: 3 });
    const rec = recommendStudyStartDate(item, REFERENCE_DATE);
    expect(rec.overloaded).toBe(true);
    expect(rec.startDate).toBe('2026-08-01');
  });

  it('handles a zero-hour item by recommending the due date with no allocation and no overload', () => {
    const item = makeItem({ dueDate: '2026-08-25', estimatedHours: 0 });
    const rec = recommendStudyStartDate(item, REFERENCE_DATE);
    expect(rec.overloaded).toBe(false);
    expect(Object.keys(rec.dailyAllocation).length).toBe(0);
  });

  it('never allocates negative hours to a day, even when existing load exceeds capacity', () => {
    const item = makeItem({ dueDate: '2026-08-19', estimatedHours: 5 });
    const existingLoad = new Map<string, number>([
      ['2026-08-19', 999],
      ['2026-08-18', 999],
      ['2026-08-17', 999],
    ]);
    const rec = recommendStudyStartDate(item, REFERENCE_DATE, existingLoad);
    for (const hours of Object.values(rec.dailyAllocation)) {
      expect(hours).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('cross-cutting integration', () => {
  it('produces a plain-data WorkloadLevel with no JSX/formatting leaking in', () => {
    const items = [makeItem({ dueDate: REFERENCE_DATE, estimatedHours: 6, type: 'exam' })];
    const dailyLoad = calculateDailyLoad(items, REFERENCE_DATE);
    const level = getWorkloadLevel(dailyLoad.get(REFERENCE_DATE) ?? 0);
    expect(typeof level).toBe('string');
    expect(['low', 'medium', 'high', 'critical']).toContain(level);
  });
});
