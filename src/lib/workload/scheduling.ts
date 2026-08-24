import type { ScheduleItem } from '@/types/schedule';
import { DAILY_SCHEDULING_CAPACITY_HOURS, TIGHT_UTILIZATION_RATIO } from './constants';
import { addDays, diffInDays, formatDateISO, toDateOnly } from './dateUtils';
import { getBaseEffectiveHours } from './dailyLoad';

/**
 * Default per-day capacity (effective hours) the recommender tries not to
 * exceed. See `DAILY_SCHEDULING_CAPACITY_HOURS` (constants.ts) for why this
 * is a dedicated planning parameter rather than one of the display-band
 * thresholds (PL-5).
 */
export const DEFAULT_DAILY_CAPACITY_HOURS = DAILY_SCHEDULING_CAPACITY_HOURS;

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
  /**
   * PL-5: true when the item isn't `overloaded`, but placing it required
   * using a day at/above `TIGHT_UTILIZATION_RATIO` of capacity — runway
   * technically exists, but at least one day in the plan is close to full.
   * The middle tier between a comfortable day and a genuinely overloaded one.
   */
  tight: boolean;
  /** True when the item is already past its due date relative to referenceDate. */
  isOverdue: boolean;
  /** Number of calendar days in the available runway from referenceDate to due date. */
  runwayDays: number;
  /** Effective hours that could not be scheduled within available daily capacity. */
  deficitHours: number;
  /** True when upcoming task has insufficient runway to fit without exceeding daily capacity. */
  runwayExhausted: boolean;
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
  const diffDays = diffInDays(due, today);

  if (diffDays < 0) {
    // Already overdue: no runway existed, so there's nothing to recommend
    // beyond "it should have started before now". Surface all hours on the
    // due date and flag as overdue.
    return {
      startDate: dueDateKey,
      dailyAllocation: { [dueDateKey]: totalHours },
      overloaded: true,
      tight: false,
      isOverdue: true,
      runwayDays: 0,
      deficitHours: totalHours,
      runwayExhausted: false,
    };
  }

  if (totalHours === 0) {
    // Nothing to schedule — recommend starting (and "finishing") on the due date.
    return {
      startDate: dueDateKey,
      dailyAllocation: {},
      overloaded: false,
      tight: false,
      isOverdue: false,
      runwayDays: diffDays + 1,
      deficitHours: 0,
      runwayExhausted: false,
    };
  }

  const allocation = new Map<string, number>();
  let remaining = totalHours;
  let cursor = due;
  // PL-5: highest observed (existing + this item's allocation) / capacity
  // across the days this item actually landed on, to derive the "tight" tier.
  let peakUtilization = 0;

  // Walk backward from the due date through (and including) today.
  while (remaining > 1e-9) {
    const dateKey = formatDateISO(cursor);
    const existing = existingDailyLoad.get(dateKey) ?? 0;
    const capacity = Math.max(0, maxDailyHours - existing);
    const allocated = Math.min(capacity, remaining);

    if (allocated > 0) {
      allocation.set(dateKey, allocated);
      remaining -= allocated;
      if (maxDailyHours > 0) {
        const utilization = (existing + allocated) / maxDailyHours;
        if (utilization > peakUtilization) peakUtilization = utilization;
      }
    }

    if (diffInDays(cursor, today) <= 0) break; // reached the earliest available day
    cursor = addDays(cursor, -1);
  }

  const overloaded = remaining > 1e-9;
  const tight = !overloaded && peakUtilization >= TIGHT_UTILIZATION_RATIO;
  const deficitHours = overloaded ? remaining : 0;

  // Sort chronologically for a stable, readable dailyAllocation record.
  const sortedEntries = Array.from(allocation.entries()).sort(([a], [b]) =>
    a < b ? -1 : a > b ? 1 : 0,
  );
  const dailyAllocation = Object.fromEntries(sortedEntries);

  const startDate = sortedEntries.length > 0 ? sortedEntries[0][0] : formatDateISO(today);

  return {
    startDate,
    dailyAllocation,
    overloaded,
    tight,
    isOverdue: false,
    runwayDays: diffDays + 1,
    deficitHours,
    runwayExhausted: overloaded,
  };
}

