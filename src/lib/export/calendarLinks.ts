/**
 * "Add to calendar" deep-link builders for Google Calendar and Outlook web.
 * These don't require a downloaded file — clicking the link opens the
 * respective web calendar with the event pre-filled.
 */
import type { Course, ScheduleItem } from '@/types/schedule';
import { formatDateBasic, formatUTCBasic, getEventWindow } from './dateUtils';

function buildSummary(item: Pick<ScheduleItem, 'title'>, course: Course | undefined): string {
  return course ? `${course.code}: ${item.title}` : item.title;
}

function buildDetails(item: Pick<ScheduleItem, 'notes'>, course: Course | undefined): string {
  const parts: string[] = [];
  if (course?.instructor) parts.push(`Instructor: ${course.instructor}`);
  if (item.notes) parts.push(item.notes);
  return parts.join('\n');
}

/**
 * Builds a Google Calendar "render" template URL that pre-fills an event
 * for the given schedule item.
 *
 * See: https://calendar.google.com/calendar/render?action=TEMPLATE
 */
export function generateGoogleCalendarUrl(item: ScheduleItem, course?: Course): string {
  const { start, end, allDay } = getEventWindow(item);

  const dates = allDay
    ? `${formatDateBasic(start)}/${formatDateBasic(end)}`
    : `${formatUTCBasic(start)}/${formatUTCBasic(end)}`;

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: buildSummary(item, course),
    dates,
  });

  const details = buildDetails(item, course);
  if (details) params.set('details', details);

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * Builds an Outlook web "deeplink compose" URL that pre-fills an event for
 * the given schedule item.
 *
 * See: https://outlook.live.com/calendar/0/deeplink/compose
 */
export function generateOutlookCalendarUrl(item: ScheduleItem, course?: Course): string {
  const { start, end, allDay } = getEventWindow(item);

  const params = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: buildSummary(item, course),
    startdt: start.toISOString(),
    enddt: end.toISOString(),
    allday: String(allDay),
  });

  const details = buildDetails(item, course);
  if (details) params.set('body', details);

  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
}
