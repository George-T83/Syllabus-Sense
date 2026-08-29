import type { Priority, ScheduleItem } from '@/types/schedule';

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Local-time calendar day key (YYYY-MM-DD).
 *
 * Deliberately NOT `toISOString().slice(0,10)` on arbitrary Date objects - that
 * converts to UTC first, so a task due 2026-09-01T23:59 local in a negative-UTC-offset
 * zone would bucket onto Sep 2.
 *
 * Accepts either a Date or string (`YYYY-MM-DD` bare date or ISO string).
 * Bare `YYYY-MM-DD` strings are returned directly to prevent timezone rollback
 * when `new Date("YYYY-MM-DD")` is invoked in negative UTC offsets.
 */
export function toDayKey(input: Date | string): string {
  if (typeof input === 'string') {
    const trimmed = input.trim();
    const match = DATE_ONLY_PATTERN.exec(trimmed);
    if (match) {
      return match[0];
    }
    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) {
      const month = String(parsed.getMonth() + 1).padStart(2, '0');
      const day = String(parsed.getDate()).padStart(2, '0');
      return `${parsed.getFullYear()}-${month}-${day}`;
    }
    return trimmed.slice(0, 10);
  }

  const month = String(input.getMonth() + 1).padStart(2, '0');
  const day = String(input.getDate()).padStart(2, '0');
  return `${input.getFullYear()}-${month}-${day}`;
}

/**
 * Parses a `YYYY-MM-DD` day key or ISO string into a local-midnight Date.
 */
export function parseDayKey(dayKey: string): Date {
  const match = DATE_ONLY_PATTERN.exec(dayKey.trim());
  if (match) {
    const [, year, month, day] = match;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }
  const parsed = new Date(dayKey);
  if (!isNaN(parsed.getTime())) {
    return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  }
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export function isSameDay(a: Date | string, b: Date | string): boolean {
  return toDayKey(a) === toDayKey(b);
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addDays(date: Date, days: number): Date {
  // Constructing via components (rather than adding ms) keeps this correct
  // across DST boundaries, where a "day" isn't always 24h.
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

export function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

/**
 * The 6x7 grid of days covering `month`, padded with leading/trailing days from
 * adjacent months so every row is a full week (Sunday-first).
 *
 * Always 42 cells so the grid doesn't reflow height between months - a month
 * needs 6 rows only when it starts late in the week and runs 30+ days, and a
 * jumping layout on every next/prev click looks broken.
 */
export function getMonthGrid(month: Date): Date[] {
  const firstOfMonth = new Date(month.getFullYear(), month.getMonth(), 1);
  const gridStart = addDays(firstOfMonth, -firstOfMonth.getDay());
  return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
}

/** The 7 days of the week containing `date`, Sunday-first. */
export function getWeekDays(date: Date): Date[] {
  const weekStart = addDays(startOfDay(date), -date.getDay());
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

// #CA-5: same high/medium/low ranking PlannerView's "Sort by: Priority"
// already uses (see PRIORITY_RANK in components/schedule/PlannerView.tsx) -
// duplicated here rather than imported since that file's constant isn't
// exported and pulling a page-level component into a shared lib module
// would be a layering inversion.
const PRIORITY_RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2 };

/**
 * Orders a day's schedule items by at-a-glance urgency - high priority
 * first, then overdue items, then soonest due - so callers that can only
 * show a couple of items (a calendar cell's chip slice, a week column's
 * "+N more" preview) reliably surface the important ones instead of
 * whichever happened to be inserted first.
 */
export function sortItemsByUrgency(items: ScheduleItem[], referenceDate: Date): ScheduleItem[] {
  return items.slice().sort((a, b) => {
    const rankA = PRIORITY_RANK[a.priority ?? 'medium'];
    const rankB = PRIORITY_RANK[b.priority ?? 'medium'];
    if (rankA !== rankB) return rankA - rankB;

    const overdueA = !a.completed && new Date(a.dueDate) < referenceDate;
    const overdueB = !b.completed && new Date(b.dueDate) < referenceDate;
    if (overdueA !== overdueB) return overdueA ? -1 : 1;

    return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
  });
}

/** Groups schedule items by their local-time due day. */
export function groupItemsByDay(items: ScheduleItem[]): Map<string, ScheduleItem[]> {
  const grouped = new Map<string, ScheduleItem[]>();
  for (const item of items) {
    const key = toDayKey(item.dueDate);
    const existing = grouped.get(key);
    if (existing) {
      existing.push(item);
    } else {
      grouped.set(key, [item]);
    }
  }
  return grouped;
}
