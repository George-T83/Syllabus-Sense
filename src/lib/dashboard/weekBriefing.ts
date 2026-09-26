import { parseDateString, toLocalDateStr } from '@/lib/planner/projectChunker';
import { getDefaultEstimatedHours } from '@/lib/workload/constants';
import { clampProgress } from '@/lib/taskStatus';
import { isCardDue } from '@/lib/flashcards/sm2';
import type { Flashcard } from '@/types/flashcard';
import type { AssignmentType, Course, ScheduleItem } from '@/types/schedule';

/** How far ahead "this week" looks, today included. */
export const BRIEFING_WINDOW_DAYS = 7;

/** Overdue work is still this week's problem, but only recent misses. */
const OVERDUE_LOOKBACK_DAYS = 7;

/**
 * For ordering only, when an item has no grade weight on record: how much a
 * piece of work of this type usually counts. Never shown as a weight - the
 * row says "weight not set" instead.
 */
const TYPICAL_STAKES: Record<AssignmentType, number> = {
  exam: 15,
  project: 10,
  quiz: 4,
  assignment: 3,
  reading: 1,
  other: 1,
};

const TESTED: ReadonlySet<AssignmentType> = new Set(['exam', 'quiz']);

export interface StudyReadiness {
  /** Flashcards in this item's course. */
  cards: number;
  /** Of those, how many are due for review today. */
  dueCards: number;
}

export interface BriefingItem {
  item: ScheduleItem;
  course?: Course;
  /** Whole days from today: 0 today, 1 tomorrow, negative when overdue. */
  daysUntilDue: number;
  /** Share of the course grade, in percent - undefined when not on record. */
  weight?: number;
  /** Remaining hours of work, after any progress already logged. */
  hoursLeft: number;
  /** Flashcard state for the course, on exams and quizzes only. */
  readiness?: StudyReadiness;
}

export interface WeekBriefing {
  /** Pending work due in the window (plus recent overdue), biggest stakes first. */
  ranked: BriefingItem[];
  /** Remaining hours across everything ranked. */
  totalHours: number;
  /** How many ranked items have a grade weight on record. */
  weightedCount: number;
  overdueCount: number;
  examCount: number;
}

function dayIndex(date: Date | string): number {
  const d = parseDateString(toLocalDateStr(date));
  return Math.round(d.getTime() / 86_400_000);
}

/**
 * Hours still to put in, in the student's own terms: their estimate (or the
 * usual one for the type) less whatever progress they've logged. Unlike the
 * workload engine's effective hours, no type multiplier - "8h project"
 * should read as 8h, not the 10.8h of perceived load it adds to a day.
 */
function hoursLeftOn(item: ScheduleItem): number {
  const raw =
    typeof item.estimatedHours === 'number' && Number.isFinite(item.estimatedHours)
      ? Math.max(0, item.estimatedHours)
      : getDefaultEstimatedHours(item.type);
  return raw * (1 - clampProgress(item.progress ?? 0) / 100);
}

function rankScore(b: BriefingItem): number {
  return b.weight ?? TYPICAL_STAKES[b.item.type] ?? 1;
}

/**
 * What matters this week: every unfinished item due in the next seven days
 * (and anything that slipped past its date in the last seven), ranked by
 * how much of a course grade it decides. Items without a weight on record
 * rank by what their type usually counts, so an unweighted exam still sits
 * above an unweighted reading. Ties go to whatever is due first.
 */
export function buildWeekBriefing(
  scheduleItems: ScheduleItem[],
  courses: Course[],
  flashcards: Flashcard[],
  today: Date = new Date(),
): WeekBriefing {
  const todayIdx = dayIndex(today);
  const courseById = new Map(courses.map((c) => [c.id, c]));

  const readinessByCourse = new Map<string, StudyReadiness>();
  for (const card of flashcards) {
    const r = readinessByCourse.get(card.courseId) ?? { cards: 0, dueCards: 0 };
    r.cards += 1;
    if (isCardDue(card, today)) r.dueCards += 1;
    readinessByCourse.set(card.courseId, r);
  }

  const ranked: BriefingItem[] = scheduleItems
    .filter((item) => !item.completed && item.dueDate)
    .map((item) => {
      const daysUntilDue = dayIndex(item.dueDate) - todayIdx;
      const weight =
        typeof item.gradeWeight === 'number' && item.gradeWeight > 0 ? item.gradeWeight : undefined;
      return {
        item,
        course: courseById.get(item.courseId),
        daysUntilDue,
        weight,
        hoursLeft: hoursLeftOn(item),
        readiness: TESTED.has(item.type)
          ? (readinessByCourse.get(item.courseId) ?? { cards: 0, dueCards: 0 })
          : undefined,
      };
    })
    .filter(
      (b) => b.daysUntilDue < BRIEFING_WINDOW_DAYS && b.daysUntilDue >= -OVERDUE_LOOKBACK_DAYS,
    )
    .sort(
      (a, b) =>
        rankScore(b) - rankScore(a) ||
        a.daysUntilDue - b.daysUntilDue ||
        a.item.title.localeCompare(b.item.title),
    );

  return {
    ranked,
    totalHours: Math.round(ranked.reduce((sum, b) => sum + b.hoursLeft, 0) * 10) / 10,
    weightedCount: ranked.filter((b) => b.weight !== undefined).length,
    overdueCount: ranked.filter((b) => b.daysUntilDue < 0).length,
    examCount: ranked.filter((b) => b.item.type === 'exam').length,
  };
}

/** "Today", "Tomorrow", "Thu", or "2 days overdue". */
export function dueLabel(daysUntilDue: number, dueDate: string): string {
  if (daysUntilDue < 0) {
    const n = -daysUntilDue;
    return `${n} ${n === 1 ? 'day' : 'days'} overdue`;
  }
  if (daysUntilDue === 0) return 'Today';
  if (daysUntilDue === 1) return 'Tomorrow';
  return new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(parseDateString(dueDate));
}

/**
 * What a point on this item is worth, in the words a student would use:
 * "every 10 points here moves your grade 2.5 points". Undefined without a
 * weight.
 */
export function pointsMoveLabel(weight: number | undefined): string | undefined {
  if (weight === undefined) return undefined;
  const move = Math.round(weight * 10) / 100; // 10 points x weight%
  return `every 10 points here moves your course grade ${move} ${move === 1 ? 'point' : 'points'}`;
}
