import { describe, it, expect } from 'vitest';
import { detectBurnoutRisk, suggestBurnoutTriage } from '../detectBurnoutRisk';
import { toDayKey } from '@/lib/calendar/dates';
import type { ScheduleItem } from '@/types/schedule';
import type { MoodEntry } from '@/types/mood';

const REFERENCE = new Date(2026, 8, 30); // Wed, Sep 30 2026

function dateKeyDaysAgo(days: number): string {
  const d = new Date(REFERENCE);
  d.setDate(d.getDate() - days);
  return toDayKey(d);
}

let idCounter = 0;
function item(overrides: Partial<ScheduleItem>): ScheduleItem {
  idCounter += 1;
  return {
    id: `item-${idCounter}`,
    courseId: 'course-1',
    title: `Item ${idCounter}`,
    type: 'assignment',
    dueDate: dateKeyDaysAgo(0),
    completed: false,
    ...overrides,
  };
}

function mood(daysAgo: number, value: MoodEntry['mood']): MoodEntry {
  const dateKey = dateKeyDaysAgo(daysAgo);
  return { id: dateKey, dateKey, mood: value, createdAt: new Date().toISOString() };
}

/** Heavy-load items on 4 of the 7 days in the week ending `weekEndDaysAgo`
 * days before REFERENCE - crosses into 'high' (6h > 5h threshold) each day. */
function heavyWeekItems(weekEndDaysAgo: number): ScheduleItem[] {
  return [0, 1, 2, 3].map((offset) =>
    item({ dueDate: dateKeyDaysAgo(weekEndDaysAgo + offset), estimatedHours: 6 }),
  );
}

describe('detectBurnoutRisk', () => {
  it('reports no risk with no data at all', () => {
    const result = detectBurnoutRisk([], [], REFERENCE);
    expect(result.atRisk).toBe(false);
    expect(result.consecutiveHeavyWeeks).toBe(0);
    expect(result.moodTrend).toBe('insufficient-data');
  });

  it('does not flag risk from heavy weeks alone, without a declining mood trend', () => {
    const items = [...heavyWeekItems(0), ...heavyWeekItems(7)];
    // Flat, consistently fine mood across the window.
    const moods = [0, 5, 10, 15, 20].map((d) => mood(d, 4));
    const result = detectBurnoutRisk(items, moods, REFERENCE);
    expect(result.consecutiveHeavyWeeks).toBeGreaterThanOrEqual(2);
    expect(result.moodTrend).not.toBe('declining');
    expect(result.atRisk).toBe(false);
  });

  it('does not flag risk from a declining mood alone, without consecutive heavy weeks', () => {
    // Only light items - no heavy week at all.
    const items = [item({ dueDate: dateKeyDaysAgo(0), estimatedHours: 1 })];
    const moods = [mood(20, 4), mood(15, 4), mood(10, 2), mood(5, 1), mood(0, 1)];
    const result = detectBurnoutRisk(items, moods, REFERENCE);
    expect(result.moodTrend).toBe('declining');
    expect(result.consecutiveHeavyWeeks).toBe(0);
    expect(result.atRisk).toBe(false);
  });

  it('flags risk when 2+ consecutive heavy weeks coincide with a declining mood trend', () => {
    const items = [...heavyWeekItems(0), ...heavyWeekItems(7)];
    const moods = [mood(20, 4), mood(15, 3), mood(10, 2), mood(5, 1), mood(0, 1)];
    const result = detectBurnoutRisk(items, moods, REFERENCE);
    expect(result.consecutiveHeavyWeeks).toBeGreaterThanOrEqual(2);
    expect(result.moodTrend).toBe('declining');
    expect(result.atRisk).toBe(true);
  });

  it('treats fewer than 4 check-ins as insufficient data, not a trend either way', () => {
    const items = [...heavyWeekItems(0), ...heavyWeekItems(7)];
    const moods = [mood(5, 4), mood(0, 1)];
    const result = detectBurnoutRisk(items, moods, REFERENCE);
    expect(result.moodTrend).toBe('insufficient-data');
    expect(result.atRisk).toBe(false);
  });

  it('does not count a single heavy week as consecutive risk', () => {
    const items = heavyWeekItems(0); // only the most recent week is heavy
    const moods = [mood(20, 4), mood(15, 3), mood(10, 2), mood(5, 1), mood(0, 1)];
    const result = detectBurnoutRisk(items, moods, REFERENCE);
    expect(result.consecutiveHeavyWeeks).toBe(1);
    expect(result.atRisk).toBe(false);
  });
});

describe('suggestBurnoutTriage', () => {
  it('returns no suggestions when there is no upcoming work', () => {
    expect(suggestBurnoutTriage([], REFERENCE)).toEqual([]);
  });

  it('suggests the single biggest upcoming item as an extension candidate', () => {
    const small = item({ dueDate: dateKeyDaysAgo(-3), estimatedHours: 1, priority: 'medium' });
    const big = item({ dueDate: dateKeyDaysAgo(-5), estimatedHours: 10, priority: 'high' });
    const suggestions = suggestBurnoutTriage([small, big], REFERENCE);
    const extension = suggestions.find((s) => s.type === 'extension');
    expect(extension?.item.id).toBe(big.id);
  });

  it('suggests a low-priority, furthest-out item as safe to deprioritize', () => {
    const soonLow = item({ dueDate: dateKeyDaysAgo(-2), estimatedHours: 2, priority: 'low' });
    const laterLow = item({ dueDate: dateKeyDaysAgo(-8), estimatedHours: 2, priority: 'low' });
    const highPriority = item({ dueDate: dateKeyDaysAgo(-5), estimatedHours: 3, priority: 'high' });
    const suggestions = suggestBurnoutTriage([soonLow, laterLow, highPriority], REFERENCE);
    const deprioritize = suggestions.find((s) => s.type === 'deprioritize');
    expect(deprioritize?.item.id).toBe(laterLow.id);
  });

  it('excludes completed items from consideration entirely', () => {
    const done = item({
      dueDate: dateKeyDaysAgo(-2),
      estimatedHours: 10,
      completed: true,
    });
    const suggestions = suggestBurnoutTriage([done], REFERENCE);
    expect(suggestions).toEqual([]);
  });

  it('ignores items outside the 10-day triage window', () => {
    const farOut = item({ dueDate: dateKeyDaysAgo(-30), estimatedHours: 10 });
    expect(suggestBurnoutTriage([farOut], REFERENCE)).toEqual([]);
  });
});
