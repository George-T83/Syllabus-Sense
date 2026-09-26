import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { WeeklyBriefingCard } from '../WeeklyBriefingCard';
import type { Flashcard } from '@/types/flashcard';
import type { Course, ScheduleItem } from '@/types/schedule';

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { uid: 'user-1', email: 'student@example.com' }, loading: false }),
}));

const day = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const courses: Course[] = [
  { id: 'cs', code: 'CSCI 213', title: 'Data Structures' },
  { id: 'bio', code: 'BIOL 150', title: 'Biology' },
];

function item(o: Partial<ScheduleItem> & { id: string; title: string }): ScheduleItem {
  return { courseId: 'cs', type: 'assignment', dueDate: day(1), completed: false, ...o };
}

const cards: Flashcard[] = [0, 1, 2].map((i) => ({
  id: `c${i}`,
  courseId: 'bio',
  front: 'q',
  back: 'a',
  interval: 1,
  repetitions: 0,
  easeFactor: 2.5,
  dueDate: day(i === 2 ? 5 : 0),
  createdAt: day(-10),
}));

describe('WeeklyBriefingCard', () => {
  beforeEach(() => window.localStorage.clear());

  it('leads with the item that decides the most, in plain words', () => {
    render(
      <WeeklyBriefingCard
        courses={courses}
        flashcards={cards}
        scheduleItems={[
          item({
            id: 'hw',
            title: 'Problem Set 4',
            gradeWeight: 5,
            dueDate: day(0),
            estimatedHours: 2,
          }),
          item({
            id: 'mid',
            title: 'Midterm',
            type: 'exam',
            gradeWeight: 25,
            courseId: 'bio',
            dueDate: day(3),
          }),
          item({ id: 'read', title: 'Chapter 7', type: 'reading', dueDate: day(1) }),
        ]}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Start with Midterm' })).toBeTruthy();
    expect(
      screen.getByText(
        /Worth 25% of your BIOL 150 grade\..*every 10 points here moves your course grade 2\.5 points/,
      ),
    ).toBeTruthy();

    const rows = within(screen.getByRole('list', { name: /biggest stakes first/i })).getAllByRole(
      'listitem',
    );
    expect(rows.map((r) => within(r).getAllByRole('link')[0].textContent)).toEqual([
      'Midterm',
      'Problem Set 4',
      'Chapter 7',
    ]);
    expect(within(rows[0]).getByRole('link', { name: 'Review 2 cards' }).getAttribute('href')).toBe(
      '/flashcards',
    );
    expect(within(rows[1]).getByText('Today')).toBeTruthy();
    expect(within(rows[1]).getByText('~2h left')).toBeTruthy();
    expect(within(rows[2]).getByText('Weight not set')).toBeTruthy();
    expect(screen.getByText(/3 things due · .* · 1 exam/)).toBeTruthy();
  });

  it('says to catch up when the top item is overdue', () => {
    render(
      <WeeklyBriefingCard
        courses={courses}
        flashcards={[]}
        scheduleItems={[
          item({ id: 'late', title: 'Lab Report', gradeWeight: 10, dueDate: day(-2) }),
        ]}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Catch up on Lab Report' })).toBeTruthy();
    expect(screen.getByText('2 days overdue')).toBeTruthy();
  });

  it('shows the rest behind a link and hides for the week once dismissed', () => {
    const many = Array.from({ length: 6 }, (_, i) =>
      item({ id: `t${i}`, title: `Task ${i}`, gradeWeight: 10 - i }),
    );
    const { container } = render(
      <WeeklyBriefingCard courses={courses} flashcards={[]} scheduleItems={many} />,
    );
    expect(screen.getByRole('link', { name: '+2 more this week' }).getAttribute('href')).toBe(
      '/tasks',
    );

    fireEvent.click(screen.getByRole('button', { name: "Dismiss this week's briefing" }));
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing when the week is clear', () => {
    const { container } = render(
      <WeeklyBriefingCard
        courses={courses}
        flashcards={[]}
        scheduleItems={[item({ id: 'done', title: 'Done', completed: true })]}
      />,
    );
    expect(container.innerHTML).toBe('');
  });
});
