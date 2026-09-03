import type { Flashcard } from '@/types/flashcard';
import { toDayKey } from '@/lib/calendar/dates';

/** The four self-rating buttons a review session shows, mapped to the
 * quality scores (0-5) the classic SM-2 algorithm expects. "Again" and
 * "Hard" both count as a lapse (quality < 3) - only "Good" and "Easy" grow
 * the interval. */
export type ReviewRating = 'again' | 'hard' | 'good' | 'easy';

const RATING_QUALITY: Record<ReviewRating, number> = {
  again: 0,
  hard: 2,
  good: 4,
  easy: 5,
};

export const SM2_DEFAULTS = {
  interval: 0,
  repetitions: 0,
  easeFactor: 2.5,
} as const;

export interface SM2State {
  interval: number;
  repetitions: number;
  easeFactor: number;
}

/**
 * Applies one review to a card's SM-2 state, returning the next interval,
 * repetition count, ease factor, and due date. Reference implementation:
 * https://en.wikipedia.org/wiki/SuperMemo#Description_of_SM-2_algorithm
 */
export function applySM2(
  state: SM2State,
  rating: ReviewRating,
  reviewedOn: Date = new Date(),
): SM2State & { dueDate: string } {
  const quality = RATING_QUALITY[rating];
  let { repetitions, easeFactor } = state;
  let interval: number;

  if (quality < 3) {
    repetitions = 0;
    interval = 1;
  } else {
    if (repetitions === 0) {
      interval = 1;
    } else if (repetitions === 1) {
      interval = 6;
    } else {
      interval = Math.round(state.interval * easeFactor);
    }
    repetitions += 1;
  }

  easeFactor = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  easeFactor = Math.max(easeFactor, 1.3);

  const due = new Date(reviewedOn);
  due.setDate(due.getDate() + interval);

  return { interval, repetitions, easeFactor, dueDate: toDayKey(due) };
}

/** A card is due once its dueDate is today or earlier (never created without
 * ever being reviewed and not yet due). */
export function isCardDue(card: Pick<Flashcard, 'dueDate'>, today: Date = new Date()): boolean {
  return card.dueDate <= toDayKey(today);
}
