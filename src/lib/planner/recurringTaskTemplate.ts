import { addDays, parseDayKey, toDayKey } from '@/lib/calendar/dates';

/**
 * Conflict-Aware Recurring Task Templates: a task defined once with a
 * repeat rule spawns multiple ScheduleItem instances instead of manual
 * re-entry each week - the "conflict-aware" half is skip-date awareness,
 * reusing the skipDates a course already models (cancelled classes,
 * holidays) rather than a new concept. Exam-cluster collision avoidance
 * (the other half of the original backlog idea) is deliberately out of
 * scope for this pass - shifting a task off a cancelled class date is an
 * unambiguous improvement, but auto-moving it away from a busy week is a
 * real scheduling judgment call that deserves its own dedicated feature,
 * not a side effect bolted onto this one.
 */

export type RecurrenceFrequency = 'weekly' | 'biweekly';

export interface RecurrenceRule {
  frequency: RecurrenceFrequency;
  /** Total instances to generate, including the first occurrence. */
  occurrences: number;
}

export interface RecurringInstance {
  /** Day-key (YYYY-MM-DD) this instance actually lands on. */
  dueDate: string;
  /** Where this instance would have landed before any skip-date shift. */
  originalDate: string;
  /** True when `dueDate` differs from `originalDate` because the naive
   * date fell on a skip date. */
  shifted: boolean;
}

/** How many days forward to look for an open slot before giving up and
 * just using the skip-date anyway - a course with an entire week skipped
 * (unlikely, but not impossible) shouldn't push a task arbitrarily far
 * from its intended week. */
const MAX_SHIFT_DAYS = 6;

/**
 * Generates `rule.occurrences` due dates starting from `startDayKey`,
 * spaced `rule.frequency` apart, shifting any instance that lands on a
 * date in `skipDates` forward to the nearest date that isn't.
 */
export function generateRecurringInstances(
  startDayKey: string,
  rule: RecurrenceRule,
  skipDates: string[],
): RecurringInstance[] {
  const skipSet = new Set(skipDates.map((d) => toDayKey(d)));
  const stepDays = rule.frequency === 'weekly' ? 7 : 14;
  const start = parseDayKey(startDayKey);

  const instances: RecurringInstance[] = [];
  for (let i = 0; i < Math.max(0, rule.occurrences); i++) {
    const naiveDate = addDays(start, i * stepDays);
    const originalDate = toDayKey(naiveDate);

    let dueDate = originalDate;
    let shiftedBy = 0;
    while (skipSet.has(dueDate) && shiftedBy < MAX_SHIFT_DAYS) {
      shiftedBy += 1;
      dueDate = toDayKey(addDays(naiveDate, shiftedBy));
    }

    instances.push({ dueDate, originalDate, shifted: dueDate !== originalDate });
  }
  return instances;
}
