import type { ReviewRating } from '@/lib/flashcards/sm2';

/**
 * Session-only scoring for a review: a gut-call before the flip, then the
 * rating. Rewarding calibration (knowing what you know) rather than raw
 * correctness is grounded in metacognition research - students who can
 * predict their own recall study the right cards. None of this is
 * persisted; SM-2 scheduling still comes solely from the rating.
 */

export type Confidence = 'know' | 'think' | 'unsure';

export type CalibrationOutcome =
  'called-it' | 'overconfident' | 'underconfident' | 'honest-miss' | 'neutral';

export interface SessionStats {
  reviewed: number;
  recalled: number;
  combo: number;
  bestCombo: number;
  points: number;
  /** Know-it / No-idea calls made (Think-so is a deliberate hedge and
   * doesn't count toward calibration either way). */
  calls: number;
  callsRight: number;
}

export const EMPTY_STATS: SessionStats = {
  reviewed: 0,
  recalled: 0,
  combo: 0,
  bestCombo: 0,
  points: 0,
  calls: 0,
  callsRight: 0,
};

/** SM-2 treats Hard as a lapse (quality < 3), so only Good and Easy count
 * as a recall here too - the combo can't disagree with the schedule. */
export function isRecalled(rating: ReviewRating): boolean {
  return rating === 'good' || rating === 'easy';
}

export function calibrate(confidence: Confidence | null, rating: ReviewRating): CalibrationOutcome {
  if (!confidence || confidence === 'think') return 'neutral';
  const recalled = isRecalled(rating);
  if (confidence === 'know') return recalled ? 'called-it' : 'overconfident';
  return recalled ? 'underconfident' : 'honest-miss';
}

const COMBO_BONUS_CAP = 10;
const FLOW_FULL_COMBO = 8;

export interface ReviewResult {
  stats: SessionStats;
  outcome: CalibrationOutcome;
  pointsEarned: number;
}

export function recordReview(
  stats: SessionStats,
  confidence: Confidence | null,
  rating: ReviewRating,
): ReviewResult {
  const recalled = isRecalled(rating);
  const outcome = calibrate(confidence, rating);
  const combo = recalled ? stats.combo + 1 : 0;

  let pointsEarned = 0;
  if (recalled) {
    pointsEarned += rating === 'easy' ? 12 : 10;
    pointsEarned += Math.min(combo - 1, COMBO_BONUS_CAP) * 2;
  }
  if (outcome === 'called-it') pointsEarned += 15;
  // Honesty is rewarded: admitting you don't know a card is exactly the
  // signal that makes spaced repetition work.
  if (outcome === 'honest-miss' || outcome === 'underconfident') pointsEarned += 5;

  const counted = outcome !== 'neutral';
  const right = outcome === 'called-it' || outcome === 'honest-miss';

  return {
    outcome,
    pointsEarned,
    stats: {
      reviewed: stats.reviewed + 1,
      recalled: stats.recalled + (recalled ? 1 : 0),
      combo,
      bestCombo: Math.max(stats.bestCombo, combo),
      points: stats.points + pointsEarned,
      calls: stats.calls + (counted ? 1 : 0),
      callsRight: stats.callsRight + (counted && right ? 1 : 0),
    },
  };
}

/** 0-1 "flow" intensity the study space reacts to; full at an 8-card run. */
export function flowLevel(combo: number): number {
  return Math.min(1, combo / FLOW_FULL_COMBO);
}

export function calibrationPct(stats: SessionStats): number | null {
  return stats.calls === 0 ? null : stats.callsRight / stats.calls;
}

export const OUTCOME_COPY: Record<CalibrationOutcome, string | null> = {
  'called-it': 'Called it',
  overconfident: 'Overconfident — it’ll be back soon',
  underconfident: 'You knew more than you thought',
  'honest-miss': 'Honest call — that’s how it sticks',
  neutral: null,
};
