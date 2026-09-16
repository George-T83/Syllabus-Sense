import type { Course, ScheduleItem } from '@/types/schedule';
import { getMeetingsForDay, timeToFractionalHours } from '@/lib/calendar/meetings';
import { toDayKey, addDays, sortItemsByUrgency } from '@/lib/calendar/dates';

/**
 * Time-blocking auto-scheduler (Part B): turns the upcoming backlog into
 * concrete "when" suggestions instead of leaving a student to figure out
 * where study time actually fits around class. Read-only and advisory -
 * nothing here is persisted; it's recomputed fresh from the same
 * scheduleItems/courses already loaded everywhere else.
 */

/** The day is only ever filled between these hours - suggesting a 6am or
 * 11pm study block isn't actually useful for most students. */
const STUDY_WINDOW_START = 9;
const STUDY_WINDOW_END = 21;

/** A single suggested block never exceeds this length - a realistic focus
 * session, not "study for 6 hours straight." */
const MAX_BLOCK_HOURS = 2;

/** Total newly-suggested study hours per day is capped here so one heavy
 * item doesn't fill a student's entire day with suggestions. */
const MAX_DAILY_SUGGESTED_HOURS = 4;

/** How many days ahead (inclusive of today) to suggest blocks for. */
const HORIZON_DAYS = 6;

/** An item with no estimatedHours still gets a token suggestion rather
 * than being skipped entirely. */
const DEFAULT_ITEM_HOURS = 1;

/** Below this, a remaining slot is too small to bother suggesting. */
const MIN_BLOCK_HOURS = 0.25;

interface FreeInterval {
  start: number;
  end: number;
}

/** The gaps left in the study window on `day` once every recurring class
 * meeting is subtracted out - a standard sweep over sorted busy intervals. */
function computeFreeIntervals(courses: Course[], day: Date): FreeInterval[] {
  const busy = getMeetingsForDay(courses, day)
    .map((occurrence) => ({
      start: timeToFractionalHours(occurrence.meeting.startTime),
      end: timeToFractionalHours(occurrence.meeting.endTime),
    }))
    .sort((a, b) => a.start - b.start);

  const free: FreeInterval[] = [];
  let cursor = STUDY_WINDOW_START;
  for (const block of busy) {
    if (block.start > cursor) {
      free.push({ start: cursor, end: Math.min(block.start, STUDY_WINDOW_END) });
    }
    cursor = Math.max(cursor, block.end);
    if (cursor >= STUDY_WINDOW_END) break;
  }
  if (cursor < STUDY_WINDOW_END) {
    free.push({ start: cursor, end: STUDY_WINDOW_END });
  }
  return free.filter((interval) => interval.end - interval.start >= MIN_BLOCK_HOURS);
}

function toTimeString(hours: number): string {
  const wholeHours = Math.floor(hours);
  const minutes = Math.round((hours - wholeHours) * 60);
  return `${String(wholeHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export interface StudyBlockSuggestion {
  /** YYYY-MM-DD, local time. */
  dateKey: string;
  /** 24-hour "HH:mm", matching MeetingTime's format. */
  startTime: string;
  endTime: string;
  item: ScheduleItem;
}

/**
 * Suggests concrete study time blocks for the upcoming, incomplete backlog
 * over the next `HORIZON_DAYS` days, filling the gaps left by each day's
 * recurring class meetings. Most urgent items (lib/calendar/dates.ts's
 * existing priority/overdue/due-date ranking) get first claim on the
 * earliest free time. Best-effort: an item that doesn't fully fit within
 * the horizon simply gets partial coverage rather than blocking everything
 * else behind it.
 */
export function suggestStudyBlocks(
  scheduleItems: ScheduleItem[],
  courses: Course[],
  referenceDate: Date = new Date(),
): StudyBlockSuggestion[] {
  const today = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate(),
  );
  const todayKey = toDayKey(today);

  const upcoming = scheduleItems.filter(
    (item) => !item.completed && toDayKey(item.dueDate) >= todayKey,
  );

  const queue = sortItemsByUrgency(upcoming, today).map((item) => ({
    item,
    remainingHours:
      item.estimatedHours && item.estimatedHours > 0 ? item.estimatedHours : DEFAULT_ITEM_HOURS,
  }));

  const suggestions: StudyBlockSuggestion[] = [];
  let queueIndex = 0;

  for (let dayOffset = 0; dayOffset <= HORIZON_DAYS && queueIndex < queue.length; dayOffset++) {
    const day = addDays(today, dayOffset);
    const dayKey = toDayKey(day);
    const freeIntervals = computeFreeIntervals(courses, day);
    let dailyAllocated = 0;

    for (const interval of freeIntervals) {
      if (dailyAllocated >= MAX_DAILY_SUGGESTED_HOURS) break;
      let cursor = interval.start;

      while (
        cursor < interval.end &&
        queueIndex < queue.length &&
        dailyAllocated < MAX_DAILY_SUGGESTED_HOURS
      ) {
        const entry = queue[queueIndex];
        if (dayKey > toDayKey(entry.item.dueDate)) {
          // Already past this item's due date - no point suggesting it later.
          queueIndex++;
          continue;
        }

        const blockLength = Math.min(
          MAX_BLOCK_HOURS,
          entry.remainingHours,
          interval.end - cursor,
          MAX_DAILY_SUGGESTED_HOURS - dailyAllocated,
        );
        if (blockLength < MIN_BLOCK_HOURS) break;

        suggestions.push({
          dateKey: dayKey,
          startTime: toTimeString(cursor),
          endTime: toTimeString(cursor + blockLength),
          item: entry.item,
        });

        cursor += blockLength;
        dailyAllocated += blockLength;
        entry.remainingHours -= blockLength;
        if (entry.remainingHours < MIN_BLOCK_HOURS) queueIndex++;
      }
    }
  }

  return suggestions;
}
