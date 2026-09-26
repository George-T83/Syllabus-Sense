import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PlannerView } from '../PlannerView';
import { AppStateProvider } from '@/context/AppStateContext';
import { ToastProvider } from '@/components/ui/Toast';
import type { Course, ScheduleItem } from '@/types/schedule';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/tasks',
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { uid: 'user-1', email: 'student@example.com' }, loading: false }),
}));

const course: Course = { id: 'cs', code: 'CSCI 213', title: 'Data Structures' };

function renderTasks(courses: Course[], scheduleItems: ScheduleItem[] = []) {
  return render(
    <ToastProvider>
      <AppStateProvider initialState={{ initialized: true, courses, scheduleItems }}>
        <PlannerView />
      </AppStateProvider>
    </ToastProvider>,
  );
}

describe('PlannerView with nothing to plan', () => {
  it('guides a student with no courses to a syllabus upload or a course', () => {
    renderTasks([]);
    expect(screen.getByRole('heading', { name: 'Start with a course' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Upload a syllabus' })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Add a course/ }).getAttribute('href')).toBe(
      '/courses',
    );
    // None of the zeroed-out planning cards.
    expect(screen.queryByText("Today's Load")).toBeNull();
    expect(screen.queryByTestId('tasks-list-card')).toBeNull();
  });

  it('offers to add a task once there is a course', () => {
    renderTasks([course]);
    expect(screen.getByRole('heading', { name: 'Your deadlines go here' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Add a task/ })).toBeTruthy();
    expect(screen.getAllByRole('listitem').map((li) => li.querySelector('p')?.textContent)).toEqual(
      ["Today's load", 'What to start when', 'Study blocks'],
    );
  });

  it('shows the real planner as soon as there is a task', () => {
    renderTasks(
      [course],
      [
        {
          id: 't1',
          courseId: 'cs',
          title: 'Problem Set 1',
          type: 'assignment',
          dueDate: '2099-01-01',
          completed: false,
        },
      ],
    );
    expect(screen.queryByRole('heading', { name: 'Your deadlines go here' })).toBeNull();
    expect(screen.getByTestId('tasks-list-card')).toBeTruthy();
  });
});
