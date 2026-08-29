export type LatePolicyType =
  | 'daily_fixed'
  | 'hourly_linear'
  | 'tiered_steps'
  | 'slip_days_grace'
  | 'no_late_work';

export interface TierStep {
  maxHours: number;
  penaltyPercentage: number;
}

export interface LatePolicyConfig {
  type: LatePolicyType;
  /** Percentage deducted per day late (e.g. 10 for 10%) */
  dailyDeductionPercent?: number;
  /** Percentage deducted per hour late (e.g. 1 for 1%) */
  hourlyDeductionPercent?: number;
  /** Tiered step boundaries */
  tiers?: TierStep[];
  /** Total slip days allowed for course */
  totalSlipDaysAllowed?: number;
  /** Hard cutoff after which 0 credit is awarded (in hours) */
  hardCutoffHours?: number;
  /** Official policy rule text from syllabus */
  rawPolicyText?: string;
}

export interface LatePenaltyResult {
  hoursLate: number;
  daysLate: number;
  rawScore: number;
  adjustedScore: number;
  penaltyPercentage: number;
  slipDaysConsumed: number;
  slipDaysRemaining: number;
  isPastHardCutoff: boolean;
  finalLetterGrade: string;
  summary: string;
}

export function calculateLatePenalty({
  rawScore,
  hoursLate,
  policy,
  slipDaysUsedSoFar = 0,
}: {
  rawScore: number;
  hoursLate: number;
  policy: LatePolicyConfig;
  slipDaysUsedSoFar?: number;
}): LatePenaltyResult {
  const safeHours = Math.max(0, hoursLate);
  const rawDays = safeHours / 24;
  const daysLateRounded = Math.ceil(safeHours / 24);

  // If on time
  if (safeHours === 0) {
    return {
      hoursLate: 0,
      daysLate: 0,
      rawScore,
      adjustedScore: rawScore,
      penaltyPercentage: 0,
      slipDaysConsumed: 0,
      slipDaysRemaining: Math.max(0, (policy.totalSlipDaysAllowed || 0) - slipDaysUsedSoFar),
      isPastHardCutoff: false,
      finalLetterGrade: scoreToLetterGrade(rawScore),
      summary: 'Submitted on time. Full credit awarded with zero late penalty.',
    };
  }

  // Check hard cutoff
  if (policy.type === 'no_late_work' || (policy.hardCutoffHours && safeHours > policy.hardCutoffHours)) {
    return {
      hoursLate: safeHours,
      daysLate: rawDays,
      rawScore,
      adjustedScore: 0,
      penaltyPercentage: 100,
      slipDaysConsumed: 0,
      slipDaysRemaining: Math.max(0, (policy.totalSlipDaysAllowed || 0) - slipDaysUsedSoFar),
      isPastHardCutoff: true,
      finalLetterGrade: 'F',
      summary:
        policy.type === 'no_late_work'
          ? 'No late work accepted under course policy. 0 credit awarded.'
          : `Submission exceeds the ${policy.hardCutoffHours}h hard cutoff. 0 credit awarded.`,
    };
  }

  let penaltyPercent = 0;
  let slipDaysConsumed = 0;
  const availableSlipDays = Math.max(0, (policy.totalSlipDaysAllowed || 0) - slipDaysUsedSoFar);

  switch (policy.type) {
    case 'daily_fixed': {
      const dailyRate = policy.dailyDeductionPercent ?? 10;
      penaltyPercent = Math.min(100, daysLateRounded * dailyRate);
      break;
    }

    case 'hourly_linear': {
      const hourlyRate = policy.hourlyDeductionPercent ?? 1;
      penaltyPercent = Math.min(100, safeHours * hourlyRate);
      break;
    }

    case 'tiered_steps': {
      const tiers = policy.tiers || [
        { maxHours: 24, penaltyPercentage: 10 },
        { maxHours: 48, penaltyPercentage: 25 },
        { maxHours: 72, penaltyPercentage: 50 },
      ];
      const matchedTier = tiers.find((t) => safeHours <= t.maxHours);
      if (matchedTier) {
        penaltyPercent = matchedTier.penaltyPercentage;
      } else {
        penaltyPercent = 100; // Past highest tier
      }
      break;
    }

    case 'slip_days_grace': {
      const daysNeeded = daysLateRounded;
      if (availableSlipDays >= daysNeeded) {
        slipDaysConsumed = daysNeeded;
        penaltyPercent = 0;
      } else {
        slipDaysConsumed = availableSlipDays;
        const unexcusedDays = daysNeeded - availableSlipDays;
        const dailyRate = policy.dailyDeductionPercent ?? 15;
        penaltyPercent = Math.min(100, unexcusedDays * dailyRate);
      }
      break;
    }
  }

  const adjustedScore = Math.max(0, Number((rawScore * (1 - penaltyPercent / 100)).toFixed(1)));
  const remainingSlips = Math.max(0, availableSlipDays - slipDaysConsumed);

  let summary = '';
  if (slipDaysConsumed > 0 && penaltyPercent === 0) {
    summary = `Grace period applied: Consumed ${slipDaysConsumed} slip ${slipDaysConsumed === 1 ? 'day' : 'days'}. 100% full credit preserved!`;
  } else if (slipDaysConsumed > 0 && penaltyPercent > 0) {
    summary = `Consumed all ${slipDaysConsumed} remaining slip days. Remaining late duration incurred a -${penaltyPercent}% penalty.`;
  } else {
    summary = `Late submission penalty of -${penaltyPercent}% applied.`;
  }

  return {
    hoursLate: safeHours,
    daysLate: Number(rawDays.toFixed(1)),
    rawScore,
    adjustedScore,
    penaltyPercentage: penaltyPercent,
    slipDaysConsumed,
    slipDaysRemaining: remainingSlips,
    isPastHardCutoff: false,
    finalLetterGrade: scoreToLetterGrade(adjustedScore),
    summary,
  };
}

function scoreToLetterGrade(score: number): string {
  if (score >= 93) return 'A';
  if (score >= 90) return 'A-';
  if (score >= 87) return 'B+';
  if (score >= 83) return 'B';
  if (score >= 80) return 'B-';
  if (score >= 77) return 'C+';
  if (score >= 73) return 'C';
  if (score >= 70) return 'C-';
  if (score >= 60) return 'D';
  return 'F';
}
