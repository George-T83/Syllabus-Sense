import { generateICS } from '@/lib/export/ics';
import { getEventWindow } from '@/lib/export/dateUtils';
import type { Course, ScheduleItem } from '@/types/schedule';

/**
 * Builds the subscribed calendar text with the same generator the Profile
 * download uses. Unlike a one-off download, a feed is fetched unattended, so
 * one item with an unreadable due date must not take the whole calendar
 * down: such items are left out instead.
 */
export function buildCalendarFeed(items: ScheduleItem[], courses: Course[], now: Date): string {
  const renderable = items.filter((item) => {
    try {
      getEventWindow(item);
      return true;
    } catch {
      return false;
    }
  });
  return generateICS(renderable, courses, now);
}
