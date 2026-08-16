/**
 * RFC 5545 (iCalendar) .ics file generation, entirely client-side and
 * dependency-free. Produces a single VCALENDAR containing one VEVENT per
 * ScheduleItem so a user can export their whole schedule (or a filtered
 * subset) and import it into Google Calendar, Outlook, Apple Calendar, etc.
 *
 * Every function here is pure: callers pass in `now` explicitly instead of
 * this module reaching for `Date.now()`, so output is deterministic and
 * trivially testable.
 */
import type { Course, ScheduleItem } from '@/types/schedule';
import { formatUTCBasic, formatDateBasic, getEventWindow } from './dateUtils';

const PRODID = '-//Syllabus Sense//Calendar Export//EN';
const CRLF = '\r\n';

/**
 * RFC 5545 §3.1 requires content lines to be folded so no line exceeds 75
 * *octets* (bytes, not UTF-16 code units — a title with emoji or accented
 * characters can be multiple octets per character). Continuation lines are
 * introduced by CRLF followed by a single linear whitespace character; that
 * leading space itself counts as one of the 75 octets on the continuation
 * line, which is why the per-line budget drops to 74 after the first line.
 *
 * We fold on UTF-8 octet boundaries and never split a multi-byte character,
 * since doing so would corrupt the text when decoded by the receiving
 * client.
 */
export function foldICSLine(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;

  const decoder = new TextDecoder();
  const segments: string[] = [];
  let start = 0;
  let budget = 75;

  while (start < bytes.length) {
    let end = Math.min(start + budget, bytes.length);
    // Back off if `end` lands inside a multi-byte UTF-8 sequence: continuation
    // bytes match the 10xxxxxx bit pattern (0x80-0xBF).
    while (end > start && end < bytes.length && (bytes[end] & 0xc0) === 0x80) {
      end -= 1;
    }
    segments.push(decoder.decode(bytes.slice(start, end)));
    start = end;
    budget = 74; // leading continuation space counts toward the 75-octet cap
  }

  return segments.join(CRLF + ' ');
}

/**
 * Escapes a TEXT value per RFC 5545 §3.3.11: backslash, comma, and
 * semicolon are escaped, and newlines become the literal two-character
 * sequence `\n`. Backslash must be escaped first so we don't double-escape
 * the backslashes introduced by the other replacements.
 */
export function escapeICSText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}

/** Builds a stable, deterministic UID for a schedule item's VEVENT. */
export function buildICSUid(item: Pick<ScheduleItem, 'id'>): string {
  return `${item.id}@syllabus-sense.app`;
}

function buildContentLine(name: string, value: string): string {
  return foldICSLine(`${name}:${value}`);
}

/**
 * Renders a single ScheduleItem as a VEVENT block (without BEGIN/END
 * wrapper newlines already joined by the caller).
 */
export function scheduleItemToVEvent(
  item: ScheduleItem,
  course: Course | undefined,
  now: Date,
): string {
  const { start, end, allDay } = getEventWindow(item);

  const summary = course ? `${course.code}: ${item.title}` : item.title;

  const descriptionParts: string[] = [];
  if (course?.instructor) descriptionParts.push(`Instructor: ${course.instructor}`);
  if (item.notes) descriptionParts.push(item.notes);
  const description = descriptionParts.join('\n');

  const lines: string[] = [
    'BEGIN:VEVENT',
    buildContentLine('UID', buildICSUid(item)),
    buildContentLine('DTSTAMP', formatUTCBasic(now)),
  ];

  if (allDay) {
    lines.push(buildContentLine('DTSTART;VALUE=DATE', formatDateBasic(start)));
    lines.push(buildContentLine('DTEND;VALUE=DATE', formatDateBasic(end)));
  } else {
    lines.push(buildContentLine('DTSTART', formatUTCBasic(start)));
    lines.push(buildContentLine('DTEND', formatUTCBasic(end)));
  }

  lines.push(buildContentLine('SUMMARY', escapeICSText(summary)));

  if (description) {
    lines.push(buildContentLine('DESCRIPTION', escapeICSText(description)));
  }

  lines.push(buildContentLine('CATEGORIES', escapeICSText(item.type.toUpperCase())));
  lines.push('END:VEVENT');

  return lines.join(CRLF);
}

/**
 * Generates a complete .ics document for a set of schedule items.
 *
 * @param items    Schedule items to export.
 * @param courses  Courses referenced by `items` (looked up by courseId);
 *                 items whose course isn't found are still exported, just
 *                 without a course prefix/instructor line.
 * @param now      The current timestamp, used for DTSTAMP. Passed explicitly
 *                 so output is deterministic in tests.
 */
export function generateICS(items: ScheduleItem[], courses: Course[], now: Date): string {
  const coursesById = new Map(courses.map((c) => [c.id, c]));

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    buildContentLine('VERSION', '2.0'),
    buildContentLine('PRODID', PRODID),
    buildContentLine('CALSCALE', 'GREGORIAN'),
  ];

  for (const item of items) {
    lines.push(scheduleItemToVEvent(item, coursesById.get(item.courseId), now));
  }

  lines.push('END:VCALENDAR');

  // Trailing CRLF: RFC 5545 content lines are each terminated by CRLF,
  // including the last one.
  return lines.join(CRLF) + CRLF;
}

/** Wraps generated .ics text in a Blob suitable for client-side download. */
export function createICSBlob(icsContent: string): Blob {
  return new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
}

/** Produces a filesystem-safe .ics filename for a schedule export. */
export function buildICSFilename(baseName: string): string {
  const safe =
    baseName
      .trim()
      .replace(/[^a-z0-9-_]+/gi, '-')
      .replace(/^-+|-+$/g, '') || 'schedule';
  return `${safe}.ics`;
}
