import type { ScheduleItem } from '@/types/schedule';
import { WORKLOAD_LEVEL_THRESHOLDS } from './constants';
import { addDays, diffInDays, formatDateISO, toDateOnly } from './dateUtils';
import { getBaseEffectiveHours } from './dailyLoad';

/** Default per-day capacity (effective hours) the recommender tries not to exceed. Matches the 'medium' band ceiling. */
export const DEFAULT_DAILY_CAPACITY_HOURS = WORKLOAD_LEVEL_THRESHOLDS.medium;

export interface RecommendStartDateOptions {
  /** Max effective hours to allow on any single day before it's considered saturated. Defaults to the 'medium' threshold. */
  maxDailyHours?: number;
}

export interface StudyStartRecommendation {
  /** ISO `YYYY-MM-DD` — the earliest day the student should begin working on this item. */
  startDate: string;
  /** Recommended hours to work on each day, keyed by ISO date, in chronological order. */
  dailyAllocation: Record<string, number>;
  /**
   * True when the days between `referenceDate` and the due date can't absorb
   * the item's hours without exceeding `maxDailyHours` on at least one day —
   * i.e. there isn't enough runway left, even starting today.
   */
  overloaded: boolean;
}

/**
 * #55 Scheduling adjuster: recommends the optimal date to start studying for
 * an item, given the cognitive load already committed on other days
 * (`existingDailyLoad`, typically the output of `calculateDailyLoad` for the
 * student's *other* items).
 *
 * Algorithm (greedy backward fill):
 * 1. Start at the due date and walk backward, one day at a time.
 * 2. Each day can absorb up to `maxDailyHours - existingLoad(day)` of this
 *    item's hours (never negative — an already-saturated day absorbs nothing).
 * 3. Keep walking backward, allocating as much as each day can take, until
 *    the item's total hours are fully placed or we reach `referenceDate`.
 * 4. The earliest day that received an allocation is the recommended start.
 *
 * Working backward from the deadline (rather than forward from today) means
 * the recommendation naturally favors starting as late as is safely possible
 * while still respecting daily capacity — leaving lighter days near "today"
 * free for other items — but still surfaces `overloaded: true` when even
 * using every available day at full capacity isn't enough runway.
 *
 * Planning hours intentionally use the unweighted-by-stress base hours (see
 * getBaseEffectiveHours): stress coefficients model *perceived* load for
 * display (#52/#54), but the actual hours of work required to finish an item
 * don't change based on how stressed the student feels about it.
 */
export function recommendStudyStartDate(
  item: ScheduleItem,
  referenceDate: Date | string,
  existingDailyLoad: Map<string, number> = new Map(),
  options: RecommendStartDateOptions = {},
): StudyStartRecommendation {
  const maxDailyHours = options.maxDailyHours ?? DEFAULT_DAILY_CAPACITY_HOURS;
  const totalHours = getBaseEffectiveHours(item);

  const today = toDateOnly(referenceDate);
  const due = toDateOnly(item.dueDate);
  const dueDateKey = formatDateISO(due);

  if (diffInDays(due, today) < 0) {
    // Already overdue: no runway existed, so there's nothing to recommend
    // beyond "it should have started before now". Surface all hours on the
    // due date and flag as overloaded.
    return {
      startDate: dueDateKey,
      dailyAllocation: { [dueDateKey]: totalHours },
      overloaded: true,
    };
  }

  if (totalHours === 0) {
    // Nothing to schedule — recommend starting (and "finishing") on the due date.
    return { startDate: dueDateKey, dailyAllocation: {}, overloaded: false };
  }

  const allocation = new Map<string, number>();
  let remaining = totalHours;
  let cursor = due;

  // Walk backward from the due date through (and including) today.
  while (remaining > 1e-9) {
    const dateKey = formatDateISO(cursor);
    const existing = existingDailyLoad.get(dateKey) ?? 0;
    const capacity = Math.max(0, maxDailyHours - existing);
    const allocated = Math.min(capacity, remaining);

    if (allocated > 0) {
      allocation.set(dateKey, allocated);
      remaining -= allocated;
    }

    if (diffInDays(cursor, today) <= 0) break; // reached the earliest available day
    cursor = addDays(cursor, -1);
  }

  const overloaded = remaining > 1e-9;

  // Sort chronologically for a stable, readable dailyAllocation record.
  const sortedEntries = Array.from(allocation.entries()).sort(([a], [b]) =>
    a < b ? -1 : a > b ? 1 : 0,
  );
  const dailyAllocation = Object.fromEntries(sortedEntries);

  const startDate = sortedEntries.length > 0 ? sortedEntries[0][0] : formatDateISO(today);

  return { startDate, dailyAllocation, overloaded };
}
