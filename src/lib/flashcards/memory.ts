import type { Flashcard } from '@/types/flashcard';
import type { ScheduleItem } from '@/types/schedule';
import { addDays, parseDayKey, startOfDay, toDayKey } from '@/lib/calendar/dates';
import { applySM2, type SM2State } from '@/lib/flashcards/sm2';

/**
 * A forgetting-curve model layered on top of the SM-2 state each card
 * already carries. SM-2 schedules a card's next review at the point its
 * recall is expected to have decayed to roughly 90%, so a card's scheduled
 * interval doubles as its "stability" - the days it takes to fall to 90%.
 * Recall between reviews then follows R(t) = 0.9^(t / S).
 *
 * Nothing here changes how cards are scheduled; it only turns the state
 * SM-2 already produced into numbers a student can act on ("if you stopped
 * studying now, you'd recall 41% of this on exam day").
 */

const TARGET_RETENTION = 0.9;
/** A card that has never been recalled successfully (new, or just lapsed)
 * is treated as fragile: half a day to fall to 90%. */
const FRAGILE_STABILITY_DAYS = 0.5;
/** A card counts as long-term once SM-2 has graduated it past its fixed
 * 1-day / 6-day opening steps. */
const LONG_TERM_STABILITY_DAYS = 6;
const DAY_MS = 86_400_000;
const MAX_SIMULATED_REVIEWS = 60;

type MemoryCard = Pick<
  Flashcard,
  'interval' | 'repetitions' | 'easeFactor' | 'dueDate' | 'lastReviewedAt'
>;

export function daysBetween(from: Date, to: Date): number {
  return Math.round(
    (parseDayKey(toDayKey(to)).getTime() - parseDayKey(toDayKey(from)).getTime()) / DAY_MS,
  );
}

/** Days for recall to decay to 90%. Ease scales it: a card the student
 * keeps rating Easy holds on longer than one they keep rating Hard, even at
 * the same scheduled interval. */
export function stabilityDays(state: SM2State): number {
  if (state.repetitions === 0) return FRAGILE_STABILITY_DAYS;
  return Math.max(1, state.interval) * (state.easeFactor / 2.5);
}

function retention(elapsedDays: number, state: SM2State): number {
  return Math.pow(TARGET_RETENTION, Math.max(0, elapsedDays) / stabilityDays(state));
}

/** Replays the reviews a student would do by following the schedule (each
 * rated Good, on its due date) up to `until`, starting no earlier than
 * `today` - an overdue card is reviewed today, not in the past. */
function simulateSchedule(
  card: MemoryCard,
  until: Date,
  today: Date,
): { lastReview: Date | null; state: SM2State } {
  let state: SM2State = {
    interval: card.interval,
    repetitions: card.repetitions,
    easeFactor: card.easeFactor,
  };
  let lastReview = card.lastReviewedAt ? startOfDay(new Date(card.lastReviewedAt)) : null;
  const floor = startOfDay(today);
  let due = parseDayKey(card.dueDate);
  if (due < floor) due = floor;

  for (let i = 0; i < MAX_SIMULATED_REVIEWS && due <= until; i++) {
    const next = applySM2(state, 'good', due);
    state = { interval: next.interval, repetitions: next.repetitions, easeFactor: next.easeFactor };
    lastReview = due;
    due = parseDayKey(next.dueDate);
  }
  return { lastReview, state };
}

/**
 * Probability the card is recalled on `on`.
 * - `followSchedule: false` - if the student never reviews it again.
 * - `followSchedule: true`  - if they keep up with every scheduled review.
 * A card never studied has no memory to recall yet, so it reads 0.
 */
export function recallOn(
  card: MemoryCard,
  on: Date,
  { followSchedule = false, today = new Date() }: { followSchedule?: boolean; today?: Date } = {},
): number {
  if (followSchedule) {
    const { lastReview, state } = simulateSchedule(card, startOfDay(on), today);
    if (!lastReview) return 0;
    return retention(daysBetween(lastReview, on), state);
  }
  if (!card.lastReviewedAt) return 0;
  return retention(daysBetween(new Date(card.lastReviewedAt), on), card);
}

export type MemoryTier = 'strong' | 'learning' | 'fading' | 'new';

export function memoryTier(card: MemoryCard, today: Date = new Date()): MemoryTier {
  if (!card.lastReviewedAt) return 'new';
  if (recallOn(card, today) < 0.6) return 'fading';
  return stabilityDays(card) >= LONG_TERM_STABILITY_DAYS ? 'strong' : 'learning';
}

export interface UpcomingExam {
  item: ScheduleItem;
  date: Date;
  daysAway: number;
}

/** The next assessment a course's flashcards are really for: its earliest
 * upcoming exam or high-stakes item, ties broken by grade weight. */
export function nextExamForCourse(
  courseId: string,
  items: ScheduleItem[],
  today: Date = new Date(),
): UpcomingExam | null {
  const floor = startOfDay(today);
  const candidates = items
    .filter(
      (i) =>
        i.courseId === courseId &&
        !i.completed &&
        (i.type === 'exam' || i.highStakes === true) &&
        parseDayKey(i.dueDate) >= floor,
    )
    .sort((a, b) => {
      const byDate = parseDayKey(a.dueDate).getTime() - parseDayKey(b.dueDate).getTime();
      return byDate !== 0 ? byDate : (b.gradeWeight ?? 0) - (a.gradeWeight ?? 0);
    });
  const item = candidates[0];
  if (!item) return null;
  const date = parseDayKey(item.dueDate);
  return { item, date, daysAway: daysBetween(floor, date) };
}

/** Average exam-day recall across a deck - the "readiness" a student sees.
 * With no exam on the calendar it looks a week ahead instead, so the number
 * still means something between exams. */
export const NO_EXAM_HORIZON_DAYS = 7;

export function readiness(
  cards: MemoryCard[],
  target: Date,
  opts: { followSchedule?: boolean; today?: Date } = {},
): number {
  if (cards.length === 0) return 0;
  return cards.reduce((sum, c) => sum + recallOn(c, target, opts), 0) / cards.length;
}

export function readinessTarget(exam: UpcomingExam | null, today: Date = new Date()): Date {
  return exam ? exam.date : addDays(startOfDay(today), NO_EXAM_HORIZON_DAYS);
}

export interface CurvePoint {
  day: number;
  date: Date;
  stopNow: number;
  onSchedule: number;
}

/** Deck-level forgetting curves from today to `target`: what recall looks
 * like if the student stops now vs. keeps up with the schedule. */
export function forgettingCurve(
  cards: MemoryCard[],
  target: Date,
  today: Date = new Date(),
): CurvePoint[] {
  const start = startOfDay(today);
  const span = Math.max(1, daysBetween(start, target));
  const points: CurvePoint[] = [];
  for (let day = 0; day <= span; day++) {
    const date = addDays(start, day);
    points.push({
      day,
      date,
      stopNow: readiness(cards, date, { today }),
      onSchedule: readiness(cards, date, { followSchedule: true, today }),
    });
  }
  return points;
}

/** Next date any of these cards comes due - the "come back on Thursday"
 * the recap points the student to. */
export function nextReviewDate(
  cards: Pick<Flashcard, 'dueDate'>[],
  today: Date = new Date(),
): Date | null {
  const floor = startOfDay(today);
  const upcoming = cards
    .map((c) => parseDayKey(c.dueDate))
    .filter((d) => d > floor)
    .sort((a, b) => a.getTime() - b.getTime());
  return upcoming[0] ?? null;
}

/** A stable pseudo-random value in [0, 1) per id, so a card keeps its place
 * in the constellation between renders and sessions. */
export function hashUnit(id: string, salt = 0): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}
