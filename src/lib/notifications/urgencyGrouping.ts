import { GRADE_WEIGHT_BADGE_THRESHOLD } from '@/components/ui/TaskRow';
import { dueInstant } from '@/lib/calendar/dates';
import type { ScheduleItem } from '@/types/schedule';

/** How far ahead of "now" an item counts as due today vs. this week vs. the
 * longer high-stakes lookahead below. Purely display buckets for the
 * notification bell - none of this changes what counts as overdue. */
export const DUE_TODAY_WINDOW_MS = 24 * 60 * 60 * 1000;
export const DUE_THIS_WEEK_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/** A high-stakes item (>= GRADE_WEIGHT_BADGE_THRESHOLD, the same cutoff
 * TaskRow already uses for its "worth N%" pill) gets surfaced this much
 * further ahead than an ordinary item would - a 40%-of-grade project two
 * weeks out deserves earlier notice than a 2%-weight reading response. */
export const HIGH_STAKES_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

export interface UrgencyGroups {
  overdue: ScheduleItem[];
  dueToday: ScheduleItem[];
  dueThisWeek: ScheduleItem[];
  highStakesAhead: ScheduleItem[];
}

/** Buckets pending (non-completed) items into urgency tiers for the
 * notification bell, each item appearing in exactly one bucket - the most
 * urgent one it qualifies for. A high-weight item due this week shows in
 * "due this week", not duplicated into "high-stakes ahead" too; that tier is
 * only for items that wouldn't otherwise be surfaced yet. */
export function groupByUrgency(items: ScheduleItem[], now: number): UrgencyGroups {
  const overdue: ScheduleItem[] = [];
  const dueToday: ScheduleItem[] = [];
  const dueThisWeek: ScheduleItem[] = [];
  const highStakesAhead: ScheduleItem[] = [];

  for (const item of items) {
    if (item.completed) continue;
    const due = dueInstant(item.dueDate).getTime();

    if (due < now) {
      overdue.push(item);
    } else if (due <= now + DUE_TODAY_WINDOW_MS) {
      dueToday.push(item);
    } else if (due <= now + DUE_THIS_WEEK_WINDOW_MS) {
      dueThisWeek.push(item);
    } else if (
      due <= now + HIGH_STAKES_WINDOW_MS &&
      (item.gradeWeight ?? 0) >= GRADE_WEIGHT_BADGE_THRESHOLD
    ) {
      highStakesAhead.push(item);
    }
  }

  const byDueDate = (a: ScheduleItem, b: ScheduleItem) =>
    dueInstant(a.dueDate).getTime() - dueInstant(b.dueDate).getTime();

  return {
    overdue: overdue.sort(byDueDate),
    dueToday: dueToday.sort(byDueDate),
    dueThisWeek: dueThisWeek.sort(byDueDate),
    highStakesAhead: highStakesAhead.sort(byDueDate),
  };
}
