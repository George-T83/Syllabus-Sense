import { calculateDailyLoad, getWorkloadLevel, recommendStudyStartDate } from '@/lib/workload';
import { addDays, formatDateISO } from '@/lib/workload/dateUtils';
import type { ScheduleItem, WorkloadLevel } from '@/types/schedule';

export interface PlannedItem {
  item: ScheduleItem;
  startDate: string;
  overloaded: boolean;
  /** PL-5: not overloaded, but placing this item used a day close to
   * capacity. See `StudyStartRecommendation.tight`. */
  tight: boolean;
  /** Already past its due date - distinct from `overloaded` (doesn't fit the
   * week's capacity). A late item and a merely-full week require different
   * reactions from the student, so they're tracked separately rather than
   * both surfacing as the same badge. */
  overdue: boolean;
}

export interface DayLoad {
  key: string;
  day: Date;
  hours: number;
  level: WorkloadLevel;
}

export interface SmartPlan {
  weekLoad: DayLoad[];
  startToday: PlannedItem[];
  startThisWeek: PlannedItem[];
  startLater: PlannedItem[];
  /**
   * PL-1: total effective hours parked on PAST due dates (i.e. excluded from
   * `weekLoad`, which only covers `referenceDate` through +6 days). Read from
   * the same `calculateDailyLoad` output `weekLoad` is built from, so this is
   * exactly the mass of hours the headline "today" figure silently drops —
   * computed here rather than left implicit so the UI can surface it as its
   * own number instead of a student having to infer it from a badge count.
   */
  overdueHours: number;
}

/**
 * The workload engine normalizes dates to UTC midnight for deterministic,
 * timezone-independent math (see lib/workload/dateUtils.ts). Constructing
 * "today" from local Y/M/D components - rather than passing `new Date()`
 * directly - keeps that UTC normalization aligned with the user's actual
 * local calendar day instead of drifting near midnight UTC.
 */
export function getLocalReferenceDate(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

/**
 * Builds a full workload-aware plan: a 7-day load strip plus every pending
 * item bucketed by when the workload engine recommends starting it.
 */
export function computeSmartPlan(scheduleItems: ScheduleItem[], referenceDate: Date): SmartPlan {
  const pendingItems = scheduleItems.filter((i) => !i.completed);
  const todayKey = formatDateISO(referenceDate);

  const load = calculateDailyLoad(pendingItems, referenceDate);
  const weekLoad: DayLoad[] = Array.from({ length: 7 }, (_, i) => {
    const day = addDays(referenceDate, i);
    const key = formatDateISO(day);
    const hours = load.get(key) ?? 0;
    return { key, day, hours, level: getWorkloadLevel(hours) };
  });

  const plannedItems: PlannedItem[] = pendingItems.map((item) => {
    // Exclude this item from "existing" load so it isn't competing with its
    // own hours when the recommender decides how much room is left.
    const others = pendingItems.filter((i) => i.id !== item.id);
    const existingLoad = calculateDailyLoad(others, referenceDate);
    const rec = recommendStudyStartDate(item, referenceDate, existingLoad);
    // Matches the exact `!completed && dueDate < now` check used on Tasks/
    // Course/Task-detail (real current moment, not the UTC-midnight
    // `referenceDate` used for workload bucketing) so "overdue" means the
    // same thing everywhere in the app.
    const overdue = !item.completed && new Date(item.dueDate) < new Date();
    return {
      item,
      startDate: rec.startDate,
      overloaded: rec.overloaded,
      tight: rec.tight,
      overdue,
    };
  });
  plannedItems.sort((a, b) => a.startDate.localeCompare(b.startDate));

  // PL-1: `load` already carries each overdue item's full hours on its own
  // (past) due date - see getItemDailyDistribution's overdue branch - so
  // summing every key strictly before today recovers exactly the overdue
  // backlog total, using the same weighting/stress math as everything else,
  // without re-deriving it or touching the weekLoad/forecast math above.
  let overdueHours = 0;
  for (const [key, hours] of Array.from(load)) {
    if (key < todayKey) overdueHours += hours;
  }

  const weekEndKey = weekLoad[6].key;
  return {
    weekLoad,
    startToday: plannedItems.filter((p) => p.startDate <= todayKey),
    startThisWeek: plannedItems.filter((p) => p.startDate > todayKey && p.startDate <= weekEndKey),
    startLater: plannedItems.filter((p) => p.startDate > weekEndKey),
    overdueHours,
  };
}
