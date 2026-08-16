import type { ScheduleItem } from '@/types/schedule';

/**
 * Local-time calendar day key (YYYY-MM-DD).
 *
 * Deliberately NOT `toISOString().slice(0,10)` - that converts to UTC first, so
 * a task due 2026-09-01T23:59 local in a negative-UTC-offset zone would bucket
 * onto Sep 2. Calendar grids are a local-time concept, so we read the local
 * date components directly.
 */
export function toDayKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function isSameDay(a: Date, b: Date): boolean {
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

/** Groups schedule items by their local-time due day. */
export function groupItemsByDay(items: ScheduleItem[]): Map<string, ScheduleItem[]> {
  const grouped = new Map<string, ScheduleItem[]>();
  for (const item of items) {
    const key = toDayKey(new Date(item.dueDate));
    const existing = grouped.get(key);
    if (existing) {
      existing.push(item);
    } else {
      grouped.set(key, [item]);
    }
  }
  return grouped;
}
