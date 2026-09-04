import { toDayKey, parseDayKey } from '@/lib/calendar/dates';
import { getWorkloadLevel } from '@/lib/workload/dailyLoad';
import type { WorkloadLevel } from '@/types/schedule';
import type { ScheduleItem } from '@/types/schedule';

export interface SemesterHeatmapDay {
  dateKey: string;
  hours: number;
  level: WorkloadLevel;
}

/** Same estimate `calculateWorkloadBreakdown` uses for an item with no
 * explicit `estimatedHours`: exams default to 2 hours, everything else to 1 -
 * kept in sync intentionally so a day's heatmap color matches what the rest
 * of the planner already implies about that day's load. */
function estimateHours(item: ScheduleItem): number {
  if (item.estimatedHours) return item.estimatedHours;
  return item.type === 'exam' ? 2 : 1;
}

/** Total due-date hours per day key, across every item that has a due date -
 * the same lookup `computeSemesterHeatmap` builds internally, exported so
 * other features (e.g. mood-vs-workload correlation) can look up a specific
 * day's load without recomputing the whole semester range. */
export function computeDayHoursMap(scheduleItems: ScheduleItem[]): Map<string, number> {
  const dayTotals = new Map<string, number>();
  for (const item of scheduleItems) {
    if (!item.dueDate) continue;
    const key = toDayKey(item.dueDate);
    dayTotals.set(key, (dayTotals.get(key) ?? 0) + estimateHours(item));
  }
  return dayTotals;
}

/** The WorkloadLevel for one specific day, given a due-hours lookup from
 * `computeDayHoursMap`. A day with nothing due at all is 'low' (light), the
 * same as `getWorkloadLevel(0)` - genuinely nothing due is the lightest
 * case, not an unknown one. */
export function getDayWorkloadLevel(dateKey: string, dayHours: Map<string, number>): WorkloadLevel {
  return getWorkloadLevel(dayHours.get(dateKey) ?? 0);
}

/**
 * A day-by-day workload heatmap spanning every due date the student has on
 * record, from the earliest to the latest - not scoped to a "current term"
 * (ScheduleItem carries no term of its own; Course.term is free text with no
 * parseable start/end date to bound a range by). In practice a student's due
 * dates cluster tightly around the courses they're actually taking, so the
 * unscoped range still reads as "this semester" for the common case.
 *
 * Every item due on a day counts toward that day's total regardless of
 * completion status - the heatmap answers "how loaded was/is this day",
 * which doesn't change once the deadline passes.
 */
export function computeSemesterHeatmap(scheduleItems: ScheduleItem[]): SemesterHeatmapDay[] {
  const dayTotals = computeDayHoursMap(scheduleItems);

  const sortedKeys = Array.from(dayTotals.keys()).sort();
  if (sortedKeys.length === 0) return [];

  const start = parseDayKey(sortedKeys[0]);
  const end = parseDayKey(sortedKeys[sortedKeys.length - 1]);

  const days: SemesterHeatmapDay[] = [];
  const cursor = new Date(start);
  while (cursor.getTime() <= end.getTime()) {
    const dateKey = toDayKey(cursor);
    const hours = dayTotals.get(dateKey) ?? 0;
    days.push({ dateKey, hours, level: getWorkloadLevel(hours) });
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}
