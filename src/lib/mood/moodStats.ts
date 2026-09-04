import { toDayKey, parseDayKey } from '@/lib/calendar/dates';
import { computeDayHoursMap, getDayWorkloadLevel } from '@/lib/planner/semesterHeatmap';
import type { MoodEntry } from '@/types/mood';
import type { ScheduleItem, WorkloadLevel } from '@/types/schedule';

function addDays(dayKey: string, delta: number): string {
  const d = parseDayKey(dayKey);
  d.setDate(d.getDate() + delta);
  return toDayKey(d);
}

/** Sorted oldest-to-newest by dateKey - most of the stats below (streak,
 * trend line) read more naturally walking forward through time. */
export function sortMoodEntries(entries: MoodEntry[]): MoodEntry[] {
  return [...entries].sort((a, b) => a.dateKey.localeCompare(b.dateKey));
}

/**
 * Current consecutive-day check-in streak, ending today. Same "today not
 * checked in yet doesn't reset it" grace as the Pomodoro study streak - a
 * student who hasn't opened the app yet this morning shouldn't see their
 * streak already broken.
 */
export function computeMoodStreak(entries: MoodEntry[], today: Date = new Date()): number {
  const dateSet = new Set(entries.map((e) => e.dateKey));
  let cursor = toDayKey(today);
  if (!dateSet.has(cursor)) {
    cursor = addDays(cursor, -1);
  }
  let streak = 0;
  while (dateSet.has(cursor)) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

export function computeAverageMood(entries: MoodEntry[]): number | null {
  if (entries.length === 0) return null;
  return entries.reduce((sum, e) => sum + e.mood, 0) / entries.length;
}

export interface MoodByWorkloadBucket {
  level: WorkloadLevel;
  count: number;
  averageMood: number | null;
}

const LEVEL_ORDER: WorkloadLevel[] = ['low', 'medium', 'high', 'critical'];

/**
 * Groups check-ins by that day's workload level and averages mood within
 * each group - the actual "does a heavier day correlate with a worse mood"
 * answer. A level with zero check-ins still appears (averageMood: null)
 * rather than being silently dropped, so the chart's x-axis is always the
 * same four bars regardless of what data happens to exist yet.
 */
export function computeMoodByWorkloadLevel(
  entries: MoodEntry[],
  scheduleItems: ScheduleItem[],
): MoodByWorkloadBucket[] {
  const dayHours = computeDayHoursMap(scheduleItems);
  const buckets = new Map<WorkloadLevel, number[]>(LEVEL_ORDER.map((l) => [l, []]));
  for (const entry of entries) {
    const level = getDayWorkloadLevel(entry.dateKey, dayHours);
    buckets.get(level)!.push(entry.mood);
  }
  return LEVEL_ORDER.map((level) => {
    const moods = buckets.get(level)!;
    return {
      level,
      count: moods.length,
      averageMood: moods.length ? moods.reduce((sum, m) => sum + m, 0) / moods.length : null,
    };
  });
}

export interface MoodTrendPoint {
  dateKey: string;
  mood: number;
}

/** The check-in history as a plain, chart-ready series - already sorted,
 * already just the two fields a trend line needs. */
export function computeMoodTrend(entries: MoodEntry[]): MoodTrendPoint[] {
  return sortMoodEntries(entries).map((e) => ({ dateKey: e.dateKey, mood: e.mood }));
}

export interface BestWorstDay {
  dateKey: string;
  mood: number;
}

/** The single highest and lowest-mood day on record, ties broken toward
 * the more recent one (a fresher "your best day" story beats a stale one). */
export function computeBestAndWorstDay(entries: MoodEntry[]): {
  best: BestWorstDay | null;
  worst: BestWorstDay | null;
} {
  if (entries.length === 0) return { best: null, worst: null };
  const sorted = sortMoodEntries(entries);
  let best = sorted[0];
  let worst = sorted[0];
  for (const entry of sorted) {
    if (entry.mood >= best.mood) best = entry;
    if (entry.mood <= worst.mood) worst = entry;
  }
  return {
    best: { dateKey: best.dateKey, mood: best.mood },
    worst: { dateKey: worst.dateKey, mood: worst.mood },
  };
}
