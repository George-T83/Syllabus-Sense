import { describe, it, expect } from 'vitest';
import {
  calculateLatePenalty,
  LatePolicyConfig,
} from '../latePenalty';

describe('Late Penalty Calculation Engine (Item 49)', () => {
  it('awards 100% full credit with zero penalty when submitted on time', () => {
    const policy: LatePolicyConfig = {
      type: 'daily_fixed',
      dailyDeductionPercent: 10,
    };

    const res = calculateLatePenalty({
      rawScore: 95,
      hoursLate: 0,
      policy,
    });

    expect(res.penaltyPercentage).toBe(0);
    expect(res.adjustedScore).toBe(95);
    expect(res.isPastHardCutoff).toBe(false);
  });

  it('calculates fixed daily deductions correctly', () => {
    const policy: LatePolicyConfig = {
      type: 'daily_fixed',
      dailyDeductionPercent: 10,
    };

    // 30 hours late = 2 days late -> 20% deduction
    const res = calculateLatePenalty({
      rawScore: 100,
      hoursLate: 30,
      policy,
    });

    expect(res.penaltyPercentage).toBe(20);
    expect(res.adjustedScore).toBe(80);
    expect(res.finalLetterGrade).toBe('B-');
  });

  it('consumes free slip days before applying penalty', () => {
    const policy: LatePolicyConfig = {
      type: 'slip_days_grace',
      totalSlipDaysAllowed: 2,
      dailyDeductionPercent: 10,
    };

    // 20 hours late with 2 available slip days -> consumes 1 slip day, 0% penalty
    const res1 = calculateLatePenalty({
      rawScore: 90,
      hoursLate: 20,
      policy,
      slipDaysUsedSoFar: 0,
    });

    expect(res1.slipDaysConsumed).toBe(1);
    expect(res1.penaltyPercentage).toBe(0);
    expect(res1.adjustedScore).toBe(90);

    // 70 hours late (3 days) with 2 available slip days -> consumes 2 slips, 1 day penalty (10%)
    const res2 = calculateLatePenalty({
      rawScore: 90,
      hoursLate: 70,
      policy,
      slipDaysUsedSoFar: 0,
    });

    expect(res2.slipDaysConsumed).toBe(2);
    expect(res2.penaltyPercentage).toBe(10);
    expect(res2.adjustedScore).toBe(81);
  });

  it('enforces hard cutoff hours and awards zero credit', () => {
    const policy: LatePolicyConfig = {
      type: 'daily_fixed',
      dailyDeductionPercent: 10,
      hardCutoffHours: 72,
    };

    const res = calculateLatePenalty({
      rawScore: 100,
      hoursLate: 75,
      policy,
    });

    expect(res.isPastHardCutoff).toBe(true);
    expect(res.adjustedScore).toBe(0);
    expect(res.penaltyPercentage).toBe(100);
    expect(res.finalLetterGrade).toBe('F');
  });
});
