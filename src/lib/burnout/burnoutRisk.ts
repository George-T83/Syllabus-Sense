import { parseDayKey, toDayKey } from '@/lib/calendar/dates';
import { computeAverageMood, sortMoodEntries } from '@/lib/mood/moodStats';
import { computeDayHoursMap, getDayWorkloadLevel } from '@/lib/planner/semesterHeatmap';
import type { MoodEntry } from '@/types/mood';
import type { ScheduleItem, WorkloadLevel } from '@/types/schedule';

/** How many days ahead count as "upcoming" when checking for a heavy stretch. */
const LOOKAHEAD_DAYS = 7;
/** How many days before today count as "recent", not counting today itself -
 * today isn't finished yet, so its own load shouldn't count as something
 * already endured. */
const LOOKBACK_DAYS = 6;
/** A mood average needs at least this many check-ins within the trailing
 * week to say anything - one bad day logged in isolation isn't a trend,
 * it's a data point, and treating it as a trend would falsely flag a
 * student who just started checking in. */
const MIN_MOOD_ENTRIES_FOR_SIGNAL = 3;

function addDaysKey(dayKey: string, delta: number): string {
  const d = parseDayKey(dayKey);
  d.setDate(d.getDate() + delta);
  return toDayKey(d);
}

export interface BurnoutFactor {
  key: string;
  label: string;
  points: number;
}

export interface BurnoutRiskResult {
  /** Reuses WorkloadLevel's 4-tier scale (and its shared color tokens) rather
   * than inventing a parallel one - a burnout risk badge should read on the
   * same visual language as every other load indicator in the app. */
  level: WorkloadLevel;
  score: number;
  /** Only the factors that actually contributed points, highest first - an
   * empty array means nothing measurable is currently elevated. */
  factors: BurnoutFactor[];
  /** False when there aren't enough recent mood check-ins to say anything
   * about mood - callers should show this as "not enough data yet" rather
   * than silently treating no data as "mood is fine". */
  hasEnoughMoodData: boolean;
}

const LEVEL_THRESHOLDS: { level: WorkloadLevel; min: number }[] = [
  { level: 'critical', min: 65 },
  { level: 'high', min: 40 },
  { level: 'medium', min: 20 },
  { level: 'low', min: 0 },
];

function scoreToLevel(score: number): WorkloadLevel {
  return LEVEL_THRESHOLDS.find((t) => score >= t.min)!.level;
}

/**
 * Combines objective workload signals (upcoming and recent heavy days,
 * overdue items) with self-reported mood into a single early-warning
 * indicator. Deliberately transparent rather than a black box: every point
 * on the score traces back to a `BurnoutFactor` a UI can list out, so a
 * student sees *why* the indicator moved, not just that it did.
 *
 * `scheduleItems` and `moodEntries` are taken as-is from whatever scope the
 * caller already has loaded (typically the whole account, unscoped by term -
 * the same choice `computeSemesterHeatmap` makes, since burnout doesn't
 * reset at a term boundary).
 */
export function computeBurnoutRisk(
  scheduleItems: ScheduleItem[],
  moodEntries: MoodEntry[],
  referenceDate: Date = new Date(),
): BurnoutRiskResult {
  const dayHours = computeDayHoursMap(scheduleItems);
  const todayKey = toDayKey(referenceDate);

  let upcomingHigh = 0;
  let upcomingCritical = 0;
  for (let i = 0; i < LOOKAHEAD_DAYS; i++) {
    const level = getDayWorkloadLevel(addDaysKey(todayKey, i), dayHours);
    if (level === 'critical') upcomingCritical++;
    else if (level === 'high') upcomingHigh++;
  }

  let recentHigh = 0;
  let recentCritical = 0;
  for (let i = 1; i <= LOOKBACK_DAYS; i++) {
    const level = getDayWorkloadLevel(addDaysKey(todayKey, -i), dayHours);
    if (level === 'critical') recentCritical++;
    else if (level === 'high') recentHigh++;
  }

  const overdueCount = scheduleItems.filter(
    (item) =>
      !item.completed &&
      parseDayKey(toDayKey(item.dueDate)).getTime() < parseDayKey(todayKey).getTime(),
  ).length;

  const factors: BurnoutFactor[] = [];
  let score = 0;

  const upcomingHeavyDays = upcomingHigh + upcomingCritical;
  const upcomingPoints = Math.min(upcomingHigh * 4 + upcomingCritical * 7, 28);
  if (upcomingPoints > 0) {
    score += upcomingPoints;
    factors.push({
      key: 'upcoming-load',
      label: `${upcomingHeavyDays} heavy day${upcomingHeavyDays === 1 ? '' : 's'} coming up in the next week`,
      points: upcomingPoints,
    });
  }

  const recentHeavyDays = recentHigh + recentCritical;
  const recentPoints = Math.min(recentHigh * 3 + recentCritical * 6, 24);
  if (recentPoints > 0) {
    score += recentPoints;
    factors.push({
      key: 'recent-load',
      label: `${recentHeavyDays} heavy day${recentHeavyDays === 1 ? '' : 's'} over the past week`,
      points: recentPoints,
    });
  }

  const overduePoints = Math.min(overdueCount, 4) * 8;
  if (overduePoints > 0) {
    score += overduePoints;
    factors.push({
      key: 'overdue',
      label: `${overdueCount} overdue item${overdueCount === 1 ? '' : 's'}`,
      points: overduePoints,
    });
  }

  const windowStartKey = addDaysKey(todayKey, -(LOOKAHEAD_DAYS - 1));
  const recentMoodEntries = sortMoodEntries(moodEntries).filter(
    (e) => e.dateKey >= windowStartKey && e.dateKey <= todayKey,
  );
  const hasEnoughMoodData = recentMoodEntries.length >= MIN_MOOD_ENTRIES_FOR_SIGNAL;

  if (hasEnoughMoodData) {
    const avg = computeAverageMood(recentMoodEntries) as number;
    const moodPoints = avg <= 1.5 ? 20 : avg <= 2.2 ? 12 : avg <= 2.8 ? 5 : 0;
    if (moodPoints > 0) {
      score += moodPoints;
      factors.push({
        key: 'low-mood',
        label: `Average mood has been low this week (${avg.toFixed(1)}/4)`,
        points: moodPoints,
      });
    }

    const mid = Math.floor(recentMoodEntries.length / 2);
    if (mid > 0) {
      const firstAvg = computeAverageMood(recentMoodEntries.slice(0, mid)) as number;
      const secondAvg = computeAverageMood(recentMoodEntries.slice(mid)) as number;
      if (firstAvg - secondAvg >= 0.5) {
        score += 10;
        factors.push({
          key: 'declining-mood',
          label: 'Mood has been trending downward this week',
          points: 10,
        });
      }
    }
  }

  factors.sort((a, b) => b.points - a.points);

  return { level: scoreToLevel(score), score, factors, hasEnoughMoodData };
}
