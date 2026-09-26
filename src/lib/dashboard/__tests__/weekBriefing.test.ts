import { describe, it, expect } from 'vitest';
import { buildWeekBriefing, dueLabel, pointsMoveLabel } from '../weekBriefing';
import type { Flashcard } from '@/types/flashcard';
import type { Course, ScheduleItem } from '@/types/schedule';

// Wednesday, 2026-09-23, local time.
const TODAY = new Date(2026, 8, 23, 10, 0);
const day = (offset: number) => {
  const d = new Date(2026, 8, 23 + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const cs: Course = { id: 'cs', code: 'CSCI 213', title: 'Data Structures' };
const bio: Course = { id: 'bio', code: 'BIOL 150', title: 'Biology' };

function item(o: Partial<ScheduleItem> & { id: string }): ScheduleItem {
  return {
    courseId: 'cs',
    title: o.id,
    type: 'assignment',
    dueDate: day(1),
    completed: false,
    ...o,
  };
}

function card(id: string, courseId: string, dueDate: string): Flashcard {
  return {
    id,
    courseId,
    front: 'q',
    back: 'a',
    interval: 1,
    repetitions: 0,
    easeFactor: 2.5,
    dueDate,
    createdAt: '2026-09-01',
  };
}

describe('buildWeekBriefing', () => {
  it('ranks the week by grade weight, then by due date', () => {
    const b = buildWeekBriefing(
      [
        item({ id: 'hw', gradeWeight: 5, dueDate: day(0) }),
        item({ id: 'midterm', type: 'exam', gradeWeight: 25, dueDate: day(4) }),
        item({ id: 'lab', gradeWeight: 5, dueDate: day(2), courseId: 'bio' }),
        item({ id: 'quiz', type: 'quiz', gradeWeight: 10, dueDate: day(1) }),
      ],
      [cs, bio],
      [],
      TODAY,
    );
    expect(b.ranked.map((r) => r.item.id)).toEqual(['midterm', 'quiz', 'hw', 'lab']);
    expect(b.ranked[2].course).toBe(cs);
    expect(b.ranked[3].course).toBe(bio);
  });

  it('ranks unweighted work by what its type usually counts, below real weights that beat it', () => {
    const b = buildWeekBriefing(
      [
        item({ id: 'reading', type: 'reading', dueDate: day(0) }),
        item({ id: 'exam', type: 'exam', dueDate: day(5) }),
        item({ id: 'essay', gradeWeight: 20, dueDate: day(3) }),
      ],
      [cs],
      [],
      TODAY,
    );
    expect(b.ranked.map((r) => r.item.id)).toEqual(['essay', 'exam', 'reading']);
    expect(b.ranked[1].weight).toBeUndefined();
    expect(b.weightedCount).toBe(1);
  });

  it('keeps the next seven days and recent overdue work, and drops finished or far-off items', () => {
    const b = buildWeekBriefing(
      [
        item({ id: 'today', dueDate: day(0) }),
        item({ id: 'day6', dueDate: day(6) }),
        item({ id: 'day7', dueDate: day(7) }),
        item({ id: 'late', dueDate: day(-2) }),
        item({ id: 'ancient', dueDate: day(-30) }),
        item({ id: 'done', dueDate: day(1), completed: true }),
      ],
      [cs],
      [],
      TODAY,
    );
    expect(b.ranked.map((r) => r.item.id).sort()).toEqual(['day6', 'late', 'today']);
    expect(b.overdueCount).toBe(1);
    expect(b.ranked.find((r) => r.item.id === 'late')!.daysUntilDue).toBe(-2);
  });

  it('reads full ISO due dates as the local day', () => {
    const b = buildWeekBriefing(
      [item({ id: 'iso', dueDate: `${day(2)}T23:59:00` })],
      [cs],
      [],
      TODAY,
    );
    expect(b.ranked[0].daysUntilDue).toBe(2);
  });

  it('counts remaining hours from the student estimate, after logged progress', () => {
    const b = buildWeekBriefing(
      [
        item({ id: 'a', estimatedHours: 4, progress: 50 }),
        item({ id: 'b', estimatedHours: 2 }),
        // The workload engine scales projects up as perceived load; the
        // briefing says what the student estimated.
        item({ id: 'p', type: 'project', estimatedHours: 8 }),
      ],
      [cs],
      [],
      TODAY,
    );
    expect(b.ranked.find((r) => r.item.id === 'a')!.hoursLeft).toBe(2);
    expect(b.ranked.find((r) => r.item.id === 'p')!.hoursLeft).toBe(8);
    expect(b.totalHours).toBe(12);
  });

  it('attaches flashcard readiness to exams and quizzes only', () => {
    const b = buildWeekBriefing(
      [
        item({ id: 'exam', type: 'exam', gradeWeight: 30, courseId: 'bio' }),
        item({ id: 'quiz', type: 'quiz', gradeWeight: 5 }),
        item({ id: 'hw', gradeWeight: 2, courseId: 'bio' }),
      ],
      [cs, bio],
      [card('1', 'bio', day(-1)), card('2', 'bio', day(0)), card('3', 'bio', day(3))],
      TODAY,
    );
    const byId = Object.fromEntries(b.ranked.map((r) => [r.item.id, r]));
    expect(byId.exam.readiness).toEqual({ cards: 3, dueCards: 2 });
    expect(byId.quiz.readiness).toEqual({ cards: 0, dueCards: 0 });
    expect(byId.hw.readiness).toBeUndefined();
    expect(b.examCount).toBe(1);
  });

  it('is empty when nothing is due', () => {
    expect(buildWeekBriefing([], [cs], [], TODAY).ranked).toEqual([]);
  });
});

describe('dueLabel', () => {
  it('speaks in days', () => {
    expect(dueLabel(0, day(0))).toBe('Today');
    expect(dueLabel(1, day(1))).toBe('Tomorrow');
    expect(dueLabel(2, day(2))).toBe('Friday');
    expect(dueLabel(-1, day(-1))).toBe('1 day overdue');
    expect(dueLabel(-3, day(-3))).toBe('3 days overdue');
  });
});

describe('pointsMoveLabel', () => {
  it('turns a weight into what ten points is worth', () => {
    expect(pointsMoveLabel(25)).toBe('every 10 points here moves your course grade 2.5 points');
    expect(pointsMoveLabel(10)).toBe('every 10 points here moves your course grade 1 point');
    expect(pointsMoveLabel(undefined)).toBeUndefined();
  });
});
