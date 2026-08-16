/**
 * Shared date/time helpers for the calendar export utilities (.ics generation
 * and "add to calendar" link builders). Kept in one place so the .ics file,
 * Google Calendar link, and Outlook link all agree on how a ScheduleItem's
 * `dueDate` maps to a start/end window.
 */
import type { ScheduleItem } from '@/types/schedule';

/** Default event length used when a ScheduleItem has no estimatedHours. */
export const DEFAULT_EVENT_DURATION_MS = 60 * 60 * 1000; // 1 hour

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * A ScheduleItem's `dueDate` may be a bare `YYYY-MM-DD` date or a full
 * ISO-8601 timestamp. Bare dates are treated as all-day events; anything
 * else is treated as a timed event.
 */
export function isDateOnly(dueDate: string): boolean {
  return DATE_ONLY_PATTERN.test(dueDate);
}

export interface EventWindow {
  start: Date;
  end: Date;
  allDay: boolean;
}

/**
 * Resolves the start/end instants for a schedule item.
 *
 * - All-day (date-only) items get a UTC midnight start and an end that is
 *   the *next* day at UTC midnight — the exclusive end date convention
 *   RFC 5545 and every mainstream calendar client use for all-day events.
 * - Timed items start at the parsed instant and run for `estimatedHours`
 *   (falling back to DEFAULT_EVENT_DURATION_MS) so the event has a
 *   nonzero, sensible duration even when no estimate was recorded.
 */
export function getEventWindow(
  item: Pick<ScheduleItem, 'dueDate' | 'estimatedHours'>,
): EventWindow {
  if (isDateOnly(item.dueDate)) {
    const [year, month, day] = item.dueDate.split('-').map(Number);
    const start = new Date(Date.UTC(year, month - 1, day));
    const end = new Date(Date.UTC(year, month - 1, day + 1));
    return { start, end, allDay: true };
  }

  const start = new Date(item.dueDate);
  if (Number.isNaN(start.getTime())) {
    throw new Error(`Invalid dueDate: "${item.dueDate}"`);
  }

  const durationMs =
    item.estimatedHours && item.estimatedHours > 0
      ? item.estimatedHours * 60 * 60 * 1000
      : DEFAULT_EVENT_DURATION_MS;

  return { start, end: new Date(start.getTime() + durationMs), allDay: false };
}

const pad2 = (n: number): string => String(n).padStart(2, '0');

/** Formats a Date as an RFC 5545 UTC timestamp: YYYYMMDDTHHMMSSZ. */
export function formatUTCBasic(date: Date): string {
  return (
    `${date.getUTCFullYear()}${pad2(date.getUTCMonth() + 1)}${pad2(date.getUTCDate())}` +
    `T${pad2(date.getUTCHours())}${pad2(date.getUTCMinutes())}${pad2(date.getUTCSeconds())}Z`
  );
}

/** Formats a Date as an RFC 5545 DATE value: YYYYMMDD (used for all-day events). */
export function formatDateBasic(date: Date): string {
  return `${date.getUTCFullYear()}${pad2(date.getUTCMonth() + 1)}${pad2(date.getUTCDate())}`;
}
