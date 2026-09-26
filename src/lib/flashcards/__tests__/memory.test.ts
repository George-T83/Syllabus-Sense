import { describe, it, expect } from 'vitest';
import {
  daysBetween,
  stabilityDays,
  recallOn,
  memoryTier,
  nextExamForCourse,
  readiness,
  readinessTarget,
  forgettingCurve,
  nextReviewDate,
  hashUnit,
} from '../memory';
import type { ScheduleItem } from '@/types/schedule';

const TODAY = new Date(2026, 8, 26, 9, 0); // Sep 26 2026, local
const day = (d: number) => new Date(2026, 8, d, 12, 0);

function card(overrides: Partial<Parameters<typeof recallOn>[0]> = {}) {
  return {
    interval: 1,
    repetitions: 1,
    easeFactor: 2.5,
    dueDate: '2026-09-27',
    lastReviewedAt: '2026-09-26T12:00:00',
    ...overrides,
  };
}

function exam(overrides: Partial<ScheduleItem> = {}): ScheduleItem {
  return {
    id: 'e1',
    courseId: 'bio',
    title: 'Midterm',
    type: 'exam',
    dueDate: '2026-10-05',
    completed: false,
    gradeWeight: 25,
    ...overrides,
  };
}

describe('memory model', () => {
  it('counts whole calendar days between dates', () => {
    expect(daysBetween(day(26), day(5 + 30))).toBe(9);
    expect(daysBetween(new Date(2026, 8, 26, 23, 59), new Date(2026, 8, 27, 0, 1))).toBe(1);
  });

  it('treats a card with no successful recall as fragile, and scales stability by ease', () => {
    expect(stabilityDays({ interval: 1, repetitions: 0, easeFactor: 1.7 })).toBe(0.5);
    expect(stabilityDays({ interval: 1, repetitions: 1, easeFactor: 2.5 })).toBe(1);
    expect(stabilityDays({ interval: 6, repetitions: 2, easeFactor: 2.6 })).toBeCloseTo(6.24);
  });

  it('reads 0 for a never-studied card and 100% on the day it was reviewed', () => {
    expect(recallOn(card({ lastReviewedAt: undefined }), TODAY)).toBe(0);
    expect(recallOn(card(), TODAY)).toBe(1);
  });

  it('decays toward the exam if the student stops now, faster after a lapse', () => {
    const examDay = day(5 + 30);
    const good = recallOn(card(), examDay);
    const lapsed = recallOn(card({ repetitions: 0, easeFactor: 1.7 }), examDay);
    expect(good).toBeCloseTo(Math.pow(0.9, 9), 5);
    expect(lapsed).toBeCloseTo(Math.pow(0.9, 18), 5);
    expect(lapsed).toBeLessThan(good);
  });

  it('projects far higher exam-day recall when the student keeps up with the schedule', () => {
    const examDay = day(5 + 30);
    // Reviews on Sep 27 (-> 6 days, due Oct 3) and Oct 3 (-> 15 days), so on
    // exam day it's 2 days into a 15-day stability window.
    const onSchedule = recallOn(card(), examDay, { followSchedule: true, today: TODAY });
    expect(onSchedule).toBeCloseTo(Math.pow(0.9, 2 / 15), 5);
    expect(onSchedule).toBeGreaterThan(recallOn(card(), examDay));
  });

  it('reviews an overdue card starting today, never in the past', () => {
    const overdue = card({ dueDate: '2026-09-20', lastReviewedAt: '2026-09-19T12:00:00' });
    expect(recallOn(overdue, TODAY, { followSchedule: true, today: TODAY })).toBe(1);
  });

  it('assigns memory tiers', () => {
    expect(memoryTier(card({ lastReviewedAt: undefined }), TODAY)).toBe('new');
    expect(
      memoryTier(card({ lastReviewedAt: '2026-09-18T12:00:00', dueDate: '2026-09-19' }), TODAY),
    ).toBe('fading');
    expect(memoryTier(card(), TODAY)).toBe('learning');
    expect(memoryTier(card({ interval: 6, repetitions: 2 }), TODAY)).toBe('learning');
    expect(memoryTier(card({ interval: 30, repetitions: 4 }), TODAY)).toBe('strong');
  });

  it("finds a course's next exam, ignoring past, completed, and other courses' items", () => {
    const items = [
      exam({ id: 'past', dueDate: '2026-09-20' }),
      exam({ id: 'done', dueDate: '2026-09-28', completed: true }),
      exam({ id: 'other', courseId: 'chem', dueDate: '2026-09-28' }),
      exam({ id: 'later', dueDate: '2026-11-01' }),
      exam({ id: 'next', dueDate: '2026-10-05' }),
      exam({ id: 'hw', type: 'assignment', dueDate: '2026-09-29' }),
    ];
    const next = nextExamForCourse('bio', items, TODAY);
    expect(next?.item.id).toBe('next');
    expect(next?.daysAway).toBe(9);
  });

  it('counts high-stakes non-exam items and breaks date ties by grade weight', () => {
    const items = [
      exam({ id: 'light', type: 'project', highStakes: true, gradeWeight: 10 }),
      exam({ id: 'heavy', type: 'project', highStakes: true, gradeWeight: 30 }),
    ];
    expect(nextExamForCourse('bio', items, TODAY)?.item.id).toBe('heavy');
    expect(nextExamForCourse('bio', [], TODAY)).toBeNull();
  });

  it('averages readiness across a deck and falls back to a week out with no exam', () => {
    const examDay = day(5 + 30);
    const cards = [card(), card({ lastReviewedAt: undefined })];
    expect(readiness(cards, examDay)).toBeCloseTo(Math.pow(0.9, 9) / 2, 5);
    expect(readiness([], examDay)).toBe(0);
    expect(daysBetween(TODAY, readinessTarget(null, TODAY))).toBe(7);
  });

  it('builds forgetting curves where following the schedule never trails stopping now', () => {
    const points = forgettingCurve([card(), card({ repetitions: 0 })], day(5 + 30), TODAY);
    expect(points).toHaveLength(10);
    expect(points[0].stopNow).toBe(1);
    for (const p of points) expect(p.onSchedule).toBeGreaterThanOrEqual(p.stopNow - 1e-9);
    expect(points[points.length - 1].stopNow).toBeLessThan(points[1].stopNow);
  });

  it('finds the next future review date', () => {
    const next = nextReviewDate(
      [{ dueDate: '2026-09-25' }, { dueDate: '2026-10-01' }, { dueDate: '2026-09-29' }],
      TODAY,
    );
    expect(next && daysBetween(TODAY, next)).toBe(3);
    expect(nextReviewDate([{ dueDate: '2026-09-26' }], TODAY)).toBeNull();
  });

  it('hashes ids to a stable unit value', () => {
    expect(hashUnit('card-1')).toBe(hashUnit('card-1'));
    expect(hashUnit('card-1')).not.toBe(hashUnit('card-2'));
    for (const id of ['a', 'b', 'xyz', '']) {
      expect(hashUnit(id)).toBeGreaterThanOrEqual(0);
      expect(hashUnit(id)).toBeLessThan(1);
    }
  });
});
