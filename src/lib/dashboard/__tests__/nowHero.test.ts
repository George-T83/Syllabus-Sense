import { describe, it, expect } from 'vitest';
import { pickNowHero } from '../nowHero';
import type { Flashcard } from '@/types/flashcard';
import type { Course, ScheduleItem } from '@/types/schedule';

// Wednesday, 2026-09-23, local time.
const TODAY = new Date(2026, 8, 23, 10, 0);
const day = (offset: number) => {
  const d = new Date(2026, 8, 23 + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const cs: Course = { id: 'cs', code: 'CSCI 213', title: 'Data Structures' };

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

function card(id: string, dueDate: string): Flashcard {
  return {
    id,
    courseId: 'cs',
    front: 'q',
    back: 'a',
    interval: 1,
    repetitions: 0,
    easeFactor: 2.5,
    dueDate,
    createdAt: '2026-09-01',
  };
}

describe('pickNowHero', () => {
  it('puts overdue or due-today work ahead of a bigger item due later', () => {
    const hero = pickNowHero(
      [
        item({ id: 'midterm', type: 'exam', gradeWeight: 25, dueDate: day(3) }),
        item({ id: 'lab', gradeWeight: 5, dueDate: day(-2) }),
        item({ id: 'pset', gradeWeight: 6, dueDate: day(0) }),
      ],
      [cs],
      [],
      TODAY,
    );
    expect(hero.kind).toBe('urgent');
    // Both lab and pset are urgent; the heavier one leads.
    expect(hero.kind === 'urgent' && hero.entry.item.id).toBe('pset');
    expect(hero.kind === 'urgent' && hero.others).toBe(2);
  });

  it('falls back to the top-ranked item when nothing is due yet', () => {
    const hero = pickNowHero(
      [
        item({ id: 'essay', gradeWeight: 10, dueDate: day(4) }),
        item({ id: 'midterm', type: 'exam', gradeWeight: 25, dueDate: day(6) }),
      ],
      [cs],
      [],
      TODAY,
    );
    expect(hero.kind).toBe('next');
    expect(hero.kind === 'next' && hero.entry.item.id).toBe('midterm');
  });

  it('ignores completed work', () => {
    const hero = pickNowHero(
      [item({ id: 'done', dueDate: day(-1), completed: true })],
      [cs],
      [],
      TODAY,
    );
    expect(hero.kind).toBe('clear');
  });

  it('suggests flashcards when there are no deadlines this week', () => {
    const hero = pickNowHero(
      [],
      [cs],
      [card('a', day(-1)), card('b', day(0)), card('c', day(5))],
      TODAY,
    );
    expect(hero).toEqual({ kind: 'cards', dueCards: 2 });
  });

  it('is all clear with nothing to do, and names the next thing past this week', () => {
    const hero = pickNowHero(
      [item({ id: 'final', type: 'exam', dueDate: day(20) })],
      [cs],
      [],
      TODAY,
    );
    expect(hero.kind).toBe('clear');
    expect(hero.kind === 'clear' && hero.upcoming?.id).toBe('final');
  });

  it('is all clear with no upcoming item at all', () => {
    expect(pickNowHero([], [cs], [], TODAY)).toEqual({ kind: 'clear', upcoming: undefined });
  });
});
