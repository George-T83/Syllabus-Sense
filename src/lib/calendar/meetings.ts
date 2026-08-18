import type { Course, MeetingTime } from '@/types/schedule';

export interface MeetingOccurrence {
  course: Course;
  meeting: MeetingTime;
}

/**
 * Every recurring class meeting (#118) that falls on `day`'s weekday, across
 * all courses, sorted by start time. `dayOfWeek` on MeetingTime is
 * Date.getDay()-compatible (0=Sunday), so no conversion is needed against
 * the calendar grid, which is also Sunday-first.
 *
 * There's no term-boundary data yet (courses only carry a free-text `term`
 * label, not start/end dates - that's #101), so a meeting matches every week
 * regardless of which month is being viewed. Acceptable for now; #101 will
 * narrow this once term boundaries exist.
 */
export function getMeetingsForDay(courses: Course[], day: Date): MeetingOccurrence[] {
  const dayOfWeek = day.getDay();
  const occurrences: MeetingOccurrence[] = [];
  for (const course of courses) {
    for (const meeting of course.meetingTimes ?? []) {
      if (meeting.dayOfWeek === dayOfWeek) {
        occurrences.push({ course, meeting });
      }
    }
  }
  occurrences.sort((a, b) => a.meeting.startTime.localeCompare(b.meeting.startTime));
  return occurrences;
}

/** Formats a 24-hour "HH:mm" string as a 12-hour clock label, e.g. "09:00" -> "9:00 AM". */
export function formatTimeLabel(time: string): string {
  const [hourStr, minute] = time.split(':');
  const hour = Number(hourStr);
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}:${minute} ${period}`;
}

/** Converts a 24-hour "HH:mm" string to fractional hours (e.g. "09:30" -> 9.5) for positioning on an hour-axis grid. */
export function timeToFractionalHours(time: string): number {
  const [hourStr, minuteStr] = time.split(':');
  return Number(hourStr) + Number(minuteStr) / 60;
}
