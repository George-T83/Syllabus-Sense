import { calculateDailyLoad, getWorkloadLevel, recommendStudyStartDate } from '@/lib/workload';
import { addDays, formatDateISO } from '@/lib/workload/dateUtils';
import type { ScheduleItem, WorkloadLevel } from '@/types/schedule';

export interface PlannedItem {
  item: ScheduleItem;
  startDate: string;
  overloaded: boolean;
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
    return { item, startDate: rec.startDate, overloaded: rec.overloaded };
  });
  plannedItems.sort((a, b) => a.startDate.localeCompare(b.startDate));

  const weekEndKey = weekLoad[6].key;
  return {
    weekLoad,
    startToday: plannedItems.filter((p) => p.startDate <= todayKey),
    startThisWeek: plannedItems.filter((p) => p.startDate > todayKey && p.startDate <= weekEndKey),
    startLater: plannedItems.filter((p) => p.startDate > weekEndKey),
  };
}
