import type { ScheduleItem, WorkloadLevel } from '@/types/schedule';
import { clampProgress } from '@/lib/taskStatus';
import {
  getAssignmentTypeWeight,
  getDefaultEstimatedHours,
  PRIORITY_STRESS_COEFFICIENT,
  STRESS_DISPOSITION_COEFFICIENT,
  WORKLOAD_LEVEL_THRESHOLDS,
  type StressDisposition,
} from './constants';
import { addDays, diffInDays, enumerateDays, formatDateISO, toDateOnly } from './dateUtils';

/** Default number of days a single item's work is spread across, counting back from its due date. */
export const DEFAULT_MAX_DISTRIBUTION_DAYS = 7;

/** Default self-reported stress disposition, used when the onboarding poll answer is unavailable. */
export const DEFAULT_STRESS_DISPOSITION: StressDisposition = 'moderate';

export interface WorkloadOptions {
  /** Self-reported baseline stress disposition from the onboarding poll (#52). Defaults to 'moderate'. */
  stressDisposition?: StressDisposition;
  /** Max number of days to spread a single item's work over. Defaults to 7. */
  maxDistributionDays?: number;
}

/**
 * #50 Core utility: resolves the "effective hours" an item represents, before
 * any time-distribution or stress adjustment.
 *
 * `estimatedHours` is optional on ScheduleItem, so we fall back to a per-type
 * default (see DEFAULT_ESTIMATED_HOURS) rather than silently treating an
 * un-estimated item as zero load. A true 0-hour item (estimatedHours: 0) is
 * respected as zero, since that's an explicit user statement, not an absence
 * of data.
 *
 * Zero-credit defense: tasks with 0 estimated hours (e.g. zero-credit lab check-ins,
 * syllabus acknowledgements, or zero-effort tasks) or invalid non-finite numbers
 * evaluate to 0 effective hours without NaN corruption or dividing by zero.
 *
 * The result is further scaled by how much of the item is *not yet* done
 * (`1 - progress/100`), so a half-finished project counts as half its
 * estimate instead of its full estimate right up until it's checked
 * complete - this is the single choke point both `calculateDailyLoad` (today
 * forward) and `recommendStudyStartDate` (backward from the due date) read
 * through, so progress-aware remaining effort is consistent everywhere the
 * workload engine is used. An item with no `progress` set behaves exactly as
 * before (fraction of 1, no change).
 */
export function getBaseEffectiveHours(item: ScheduleItem): number {
  const rawHours =
    typeof item.estimatedHours === 'number'
      ? !Number.isFinite(item.estimatedHours) || item.estimatedHours <= 0
        ? 0
        : item.estimatedHours
      : getDefaultEstimatedHours(item.type);

  if (rawHours <= 0) {
    return 0;
  }

  const weight = getAssignmentTypeWeight(item.type);
  const remainingFraction = Math.max(0, Math.min(1, 1 - clampProgress(item.progress ?? 0) / 100));
  const effectiveHours = rawHours * weight * remainingFraction;
  return Number.isFinite(effectiveHours) && effectiveHours > 0 ? effectiveHours : 0;
}

/**
 * #52 Applies the stress-factor coefficients (disposition x priority) to a
 * base hours figure. This scales *perceived* load, not planning hours, which
 * is why it's applied at the display/aggregation stage (calculateDailyLoad)
 * rather than baked into the study-time recommendations in scheduling.ts.
 */
export function applyStressFactor(
  baseHours: number,
  priority: ScheduleItem['priority'],
  disposition: StressDisposition = DEFAULT_STRESS_DISPOSITION,
): number {
  if (!Number.isFinite(baseHours) || baseHours <= 0) return 0;
  const priorityCoefficient =
    (priority && PRIORITY_STRESS_COEFFICIENT[priority]) ?? PRIORITY_STRESS_COEFFICIENT.medium;
  const dispositionCoefficient =
    (disposition && STRESS_DISPOSITION_COEFFICIENT[disposition]) ??
    STRESS_DISPOSITION_COEFFICIENT[DEFAULT_STRESS_DISPOSITION];
  const adjusted = baseHours * dispositionCoefficient * priorityCoefficient;
  return Number.isFinite(adjusted) && adjusted > 0 ? adjusted : 0;
}

/**
 * #51 Distributes a single item's effective hours across the days available
 * before its due date, so the load doesn't all land on one day.
 *
 * Window selection:
 * - If the item is already overdue relative to `referenceDate`, there is no
 *   time left to spread work across, so all hours land on the due date itself
 *   (#53 edge case: tasks due in the past).
 * - Otherwise the window runs from `max(today, dueDate - (maxDistributionDays - 1))`
 *   through the due date, inclusive. Capping the lookback keeps long-range
 *   items (e.g. a project due in 10 weeks) from spreading imperceptibly thin;
 *   students realistically ramp up focus in the final stretch, not the whole term.
 *
 * Hours are split evenly across the window. Even distribution is a deliberate
 * simplification: it guarantees no single day is dumped on, and it composes
 * predictably with overlapping items (#56) since each item's contribution to
 * any given day is independent of how many other items are competing for it.
 */
export function getItemDailyDistribution(
  item: ScheduleItem,
  referenceDate: Date | string,
  options: WorkloadOptions = {},
): Map<string, number> {
  const distribution = new Map<string, number>();
  const totalHours = getBaseEffectiveHours(item);

  const today = toDateOnly(referenceDate);
  const due = toDateOnly(item.dueDate);
  const maxDays = Math.max(1, options.maxDistributionDays ?? DEFAULT_MAX_DISTRIBUTION_DAYS);

  if (diffInDays(due, today) < 0) {
    // Overdue: nothing to spread, park it all on the due date.
    distribution.set(formatDateISO(due), totalHours);
    return distribution;
  }

  if (totalHours <= 0) {
    // Zero-credit / zero-hour defense: park 0 on due date without creating multi-day zero allocations
    distribution.set(formatDateISO(due), 0);
    return distribution;
  }

  const earliestPossibleStart = addDays(due, -(maxDays - 1));
  const windowStart =
    earliestPossibleStart.getTime() > today.getTime() ? earliestPossibleStart : today;
  const windowDays = enumerateDays(windowStart, due);

  if (windowDays.length === 0) {
    distribution.set(formatDateISO(due), totalHours);
    return distribution;
  }

  const hoursPerDay = totalHours / windowDays.length;
  for (const day of windowDays) {
    distribution.set(formatDateISO(day), hoursPerDay);
  }
  return distribution;
}

/**
 * #50/#51/#56 Aggregates cognitive load across all (incomplete) schedule
 * items into a per-day map, in effective hours already adjusted by the
 * stress factor (#52).
 *
 * Completed items are excluded entirely: finished work no longer occupies
 * cognitive bandwidth, regardless of when it was due (#53 edge case).
 *
 * Overlapping deadlines (#56) are handled implicitly: each item's daily
 * distribution is added into the shared map rather than replacing existing
 * entries, so multiple items due on/around the same day accumulate load
 * instead of one overwriting another.
 */
export function calculateDailyLoad(
  items: ScheduleItem[],
  referenceDate: Date | string,
  options: WorkloadOptions = {},
): Map<string, number> {
  const dailyLoad = new Map<string, number>();

  for (const item of items) {
    if (item.completed) continue;

    const baseDistribution = getItemDailyDistribution(item, referenceDate, options);
    for (const [dateKey, baseHours] of Array.from(baseDistribution)) {
      if (!Number.isFinite(baseHours) || baseHours <= 0) continue;
      const adjustedHours = applyStressFactor(baseHours, item.priority, options.stressDisposition);
      if (!Number.isFinite(adjustedHours) || adjustedHours <= 0) continue;
      dailyLoad.set(dateKey, (dailyLoad.get(dateKey) ?? 0) + adjustedHours);
    }
  }

  return dailyLoad;
}

/**
 * #54 Visual indicator thresholds: classifies a day's effective load (in
 * hours, post stress-adjustment) into a WorkloadLevel. Returns data only —
 * no JSX/formatting — callers decide how to render it.
 *
 * Boundaries: see WORKLOAD_LEVEL_THRESHOLDS in constants.ts for rationale.
 * Boundaries are treated as the top of each band (inclusive), e.g. exactly
 * 3.0 hours is still 'low', and exactly 8.0 hours is already 'critical'.
 */
export function getWorkloadLevel(hours: number): WorkloadLevel {
  if (!Number.isFinite(hours) || hours <= 0 || hours <= WORKLOAD_LEVEL_THRESHOLDS.low) return 'low';
  if (hours <= WORKLOAD_LEVEL_THRESHOLDS.medium) return 'medium';
  if (hours < WORKLOAD_LEVEL_THRESHOLDS.high) return 'high';
  return 'critical';
}
