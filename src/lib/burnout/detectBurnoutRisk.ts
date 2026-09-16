import { toDayKey, parseDayKey } from '@/lib/calendar/dates';
import { computeDayHoursMap, getDayWorkloadLevel } from '@/lib/planner/semesterHeatmap';
import type { MoodEntry } from '@/types/mood';
import type { ScheduleItem, WorkloadLevel } from '@/types/schedule';

/**
 * Burnout early-warning system (Part B #12): "N consecutive heavy weeks +
 * declining mood trend" as a concrete, testable signal, built on the same
 * day-hours model lib/mood/moodStats.ts already uses to correlate mood with
 * workload (computeDayHoursMap + getDayWorkloadLevel) - not a new, third
 * parallel workload model.
 */

const WEEK_LENGTH_DAYS = 7;
const HEAVY_LEVELS: readonly WorkloadLevel[] = ['high', 'critical'];

/** A week counts as "heavy" once at least this many of its 7 days are
 * high/critical load - one rough day among six light ones isn't a heavy
 * week, but a genuine majority is. */
const HEAVY_DAY_THRESHOLD = 4;

/** How many trailing weeks to scan for a consecutive-heavy streak, and the
 * matching window mood check-ins are drawn from - a burnout call should
 * reflect recent life, not the whole term. */
const WEEKS_TO_SCAN = 6;

/** Consecutive heavy weeks required, together with a declining mood trend,
 * before this is treated as an actual risk rather than one rough patch. */
const CONSECUTIVE_HEAVY_WEEKS_THRESHOLD = 2;

/** Fewer check-ins than this in the scan window is noise, not a trend. */
const MIN_CHECKINS_FOR_TREND = 4;

/** Moods are a 1-4 scale, so a swing of at least half a step between the
 * earlier and later half of the window is a real move, not day-to-day noise. */
const TREND_DELTA_THRESHOLD = 0.5;

function dayKeyAddDays(dayKey: string, delta: number): string {
  const d = parseDayKey(dayKey);
  d.setDate(d.getDate() + delta);
  return toDayKey(d);
}

/** Classifies the 7-day window ending at `weekEndKey` (inclusive) as heavy. */
function isHeavyWeek(weekEndKey: string, dayHours: Map<string, number>): boolean {
  let heavyDays = 0;
  let cursor = weekEndKey;
  for (let i = 0; i < WEEK_LENGTH_DAYS; i++) {
    if (HEAVY_LEVELS.includes(getDayWorkloadLevel(cursor, dayHours))) heavyDays += 1;
    cursor = dayKeyAddDays(cursor, -1);
  }
  return heavyDays >= HEAVY_DAY_THRESHOLD;
}

export type MoodTrend = 'declining' | 'flat' | 'improving' | 'insufficient-data';

function computeRecentMoodTrend(entries: MoodEntry[]): MoodTrend {
  if (entries.length < MIN_CHECKINS_FOR_TREND) return 'insufficient-data';
  const sorted = [...entries].sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  const mid = Math.floor(sorted.length / 2);
  const average = (list: MoodEntry[]) => list.reduce((sum, e) => sum + e.mood, 0) / list.length;
  const delta = average(sorted.slice(mid)) - average(sorted.slice(0, mid));
  if (delta <= -TREND_DELTA_THRESHOLD) return 'declining';
  if (delta >= TREND_DELTA_THRESHOLD) return 'improving';
  return 'flat';
}

export interface BurnoutRiskResult {
  atRisk: boolean;
  consecutiveHeavyWeeks: number;
  moodTrend: MoodTrend;
}

export function detectBurnoutRisk(
  scheduleItems: ScheduleItem[],
  moodEntries: MoodEntry[],
  referenceDate: Date = new Date(),
): BurnoutRiskResult {
  const dayHours = computeDayHoursMap(scheduleItems);
  const todayKey = toDayKey(referenceDate);

  let consecutiveHeavyWeeks = 0;
  let weekEndKey = todayKey;
  for (let i = 0; i < WEEKS_TO_SCAN; i++) {
    if (!isHeavyWeek(weekEndKey, dayHours)) break;
    consecutiveHeavyWeeks += 1;
    weekEndKey = dayKeyAddDays(weekEndKey, -WEEK_LENGTH_DAYS);
  }

  const windowStartKey = dayKeyAddDays(todayKey, -WEEKS_TO_SCAN * WEEK_LENGTH_DAYS);
  const recentEntries = moodEntries.filter(
    (e) => e.dateKey >= windowStartKey && e.dateKey <= todayKey,
  );
  const moodTrend = computeRecentMoodTrend(recentEntries);

  return {
    atRisk: consecutiveHeavyWeeks >= CONSECUTIVE_HEAVY_WEEKS_THRESHOLD && moodTrend === 'declining',
    consecutiveHeavyWeeks,
    moodTrend,
  };
}

/** Upcoming items due within this many days count as "driving" the current
 * heavy stretch - the actual backlog, not the whole term's worth of work. */
const TRIAGE_WINDOW_DAYS = 10;

export interface BurnoutTriageSuggestion {
  type: 'extension' | 'deprioritize';
  item: ScheduleItem;
}

/**
 * Concrete triage for an at-risk student: one item worth asking for more
 * time on (the single biggest upcoming time commitment), and one that's
 * safe to push (the lowest-priority upcoming item, due furthest out among
 * the low-priority candidates). Either or both may be absent if the
 * upcoming backlog doesn't have a clear candidate.
 */
export function suggestBurnoutTriage(
  scheduleItems: ScheduleItem[],
  referenceDate: Date = new Date(),
): BurnoutTriageSuggestion[] {
  const todayKey = toDayKey(referenceDate);
  const windowEndKey = dayKeyAddDays(todayKey, TRIAGE_WINDOW_DAYS);

  const upcoming = scheduleItems.filter((item) => {
    if (item.completed) return false;
    const dueKey = toDayKey(item.dueDate);
    return dueKey >= todayKey && dueKey <= windowEndKey;
  });

  const suggestions: BurnoutTriageSuggestion[] = [];

  const biggest = [...upcoming].sort(
    (a, b) => (b.estimatedHours ?? 0) - (a.estimatedHours ?? 0),
  )[0];
  if (biggest && (biggest.estimatedHours ?? 0) > 0) {
    suggestions.push({ type: 'extension', item: biggest });
  }

  const deprioritizable = upcoming
    .filter((item) => (item.priority ?? 'medium') === 'low' && item.id !== biggest?.id)
    .sort((a, b) => toDayKey(b.dueDate).localeCompare(toDayKey(a.dueDate)))[0];
  if (deprioritizable) {
    suggestions.push({ type: 'deprioritize', item: deprioritizable });
  }

  return suggestions;
}
