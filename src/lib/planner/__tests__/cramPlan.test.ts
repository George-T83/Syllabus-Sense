import { describe, it, expect } from 'vitest';
import { daysUntilExam, cramPlanLength, MAX_CRAM_DAYS } from '@/lib/planner/cramPlan';

describe('daysUntilExam', () => {
  it('returns a positive count for a future exam', () => {
    const today = new Date(2026, 8, 3); // Sep 3, 2026
    expect(daysUntilExam('2026-09-09', today)).toBe(6);
  });

  it('returns 1 for an exam tomorrow', () => {
    const today = new Date(2026, 8, 3);
    expect(daysUntilExam('2026-09-04', today)).toBe(1);
  });

  it('returns 0 for an exam today', () => {
    const today = new Date(2026, 8, 3);
    expect(daysUntilExam('2026-09-03', today)).toBe(0);
  });

  it('returns a negative count for a past exam', () => {
    const today = new Date(2026, 8, 3);
    expect(daysUntilExam('2026-09-01', today)).toBe(-2);
  });
});

describe('cramPlanLength', () => {
  it('matches daysUntil when under the cap', () => {
    expect(cramPlanLength(6)).toBe(6);
  });

  it('caps at MAX_CRAM_DAYS when the exam is far off', () => {
    expect(cramPlanLength(30)).toBe(MAX_CRAM_DAYS);
  });

  it('never goes negative for a past-due exam', () => {
    expect(cramPlanLength(-3)).toBe(0);
  });

  it('respects a custom cap', () => {
    expect(cramPlanLength(10, 5)).toBe(5);
  });
});
