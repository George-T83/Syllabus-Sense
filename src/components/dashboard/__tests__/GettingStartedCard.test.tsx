import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, renderHook, screen, within } from '@testing-library/react';
import { GettingStartedCard, useSetupChecklistDismissed } from '../GettingStartedCard';
import type { Course, ScheduleItem } from '@/types/schedule';

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { uid: 'user-1', email: 'student@example.com' }, loading: false }),
}));

const course: Course = { id: 'cs', code: 'CSCI 213', title: 'Data Structures' };
const task: ScheduleItem = {
  id: 't1',
  courseId: 'cs',
  title: 'Problem Set 1',
  type: 'assignment',
  dueDate: '2026-10-01',
  completed: false,
};

function renderCard(props: Partial<Parameters<typeof GettingStartedCard>[0]> = {}) {
  const handlers = {
    onUploadSyllabus: vi.fn(),
    onAddCourse: vi.fn(),
    onAddTask: vi.fn(),
    onDismiss: vi.fn(),
  };
  const utils = render(
    <GettingStartedCard
      courses={[]}
      scheduleItems={[]}
      flashcards={[]}
      dismissed={false}
      {...handlers}
      {...props}
    />,
  );
  return { ...utils, ...handlers };
}

describe('GettingStartedCard', () => {
  beforeEach(() => window.localStorage.clear());

  it('leads a brand-new student to a syllabus upload, with no way to dismiss it', () => {
    const { onUploadSyllabus, onAddCourse } = renderCard();
    expect(screen.getByRole('heading', { name: "Let's set up your semester" })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Hide the setup checklist' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Upload a syllabus' }));
    expect(onUploadSyllabus).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /Add by hand/ }));
    expect(onAddCourse).toHaveBeenCalled();

    const bar = screen.getByRole('progressbar', { name: 'Setup progress' });
    expect(bar.getAttribute('aria-valuetext')).toBe('0 of 4 steps done');
  });

  it('moves on to deadlines once a course exists', () => {
    const { onAddTask } = renderCard({ courses: [course] });
    expect(
      screen.getByRole('heading', { name: '1 of 4 done. Next: get your deadlines in' }),
    ).toBeTruthy();
    const steps = within(screen.getByRole('list', { name: 'Setup steps' })).getAllByRole(
      'listitem',
    );
    expect(steps[0].textContent).toContain('done');
    fireEvent.click(screen.getByRole('button', { name: /Add a deadline/ }));
    expect(onAddTask).toHaveBeenCalled();
  });

  it('points to Tasks for weights and Flashcards for the last step', () => {
    const { rerender } = renderCard({ courses: [course], scheduleItems: [task] });
    expect(screen.getByRole('link', { name: /Open your tasks/ }).getAttribute('href')).toBe(
      '/tasks',
    );
    rerender(
      <GettingStartedCard
        courses={[course]}
        scheduleItems={[{ ...task, gradeWeight: 10 }]}
        flashcards={[]}
        onUploadSyllabus={vi.fn()}
        onAddCourse={vi.fn()}
        onAddTask={vi.fn()}
        dismissed={false}
        onDismiss={vi.fn()}
      />,
    );
    expect(screen.getByRole('link', { name: /Go to flashcards/ }).getAttribute('href')).toBe(
      '/flashcards',
    );
  });

  it('can be hidden once there is a course', () => {
    const { onDismiss } = renderCard({ courses: [course] });
    fireEvent.click(screen.getByRole('button', { name: 'Hide the setup checklist' }));
    expect(onDismiss).toHaveBeenCalled();
    const hidden = renderCard({ courses: [course], dismissed: true });
    expect(hidden.container.innerHTML).toBe('');
  });

  it('ignores a stale dismissal while there are no courses', () => {
    renderCard({ dismissed: true });
    expect(screen.getByRole('heading', { name: "Let's set up your semester" })).toBeTruthy();
  });

  it('remembers the dismissal per account', () => {
    const first = renderHook(() => useSetupChecklistDismissed());
    expect(first.result.current[0]).toBe(false);
    act(() => first.result.current[1]());
    expect(first.result.current[0]).toBe(true);
    const again = renderHook(() => useSetupChecklistDismissed());
    expect(again.result.current[0]).toBe(true);
  });

  it('disappears when every step is done', () => {
    const { container } = renderCard({
      courses: [course],
      scheduleItems: [{ ...task, gradeWeight: 10 }],
      flashcards: [
        {
          id: 'f',
          courseId: 'cs',
          front: 'q',
          back: 'a',
          interval: 1,
          repetitions: 0,
          easeFactor: 2.5,
          dueDate: '2026-10-01',
          createdAt: '2026-09-01',
        },
      ],
    });
    expect(container.innerHTML).toBe('');
  });
});
