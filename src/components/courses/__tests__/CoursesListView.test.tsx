import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CoursesListView } from '../CoursesListView';
import { AppStateProvider } from '@/context/AppStateContext';
import { ToastProvider } from '@/components/ui/Toast';
import type { Course, ScheduleItem } from '@/types/schedule';

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { uid: 'user-1', email: 'student@example.com' }, loading: false }),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

function item(o: Partial<ScheduleItem> & { id: string; courseId: string }): ScheduleItem {
  return { title: o.id, type: 'assignment', dueDate: '2026-09-01', completed: true, ...o };
}

function renderCourses(courses: Course[], scheduleItems: ScheduleItem[] = []) {
  return render(
    <ToastProvider>
      <AppStateProvider initialState={{ courses, scheduleItems }}>
        <CoursesListView />
      </AppStateProvider>
    </ToastProvider>,
  );
}

describe('CoursesListView GPA stat', () => {
  it('shows nothing when no course has a graded item', () => {
    renderCourses([
      { id: 'a', code: 'CS 101', title: 'Intro', color: 'bg-blue-500' },
      { id: 'b', code: 'MATH 201', title: 'Calc II', color: 'bg-green-500' },
    ]);
    expect(screen.queryByText(/GPA/)).toBeNull();
  });

  it('shows a credit-weighted GPA once at least one course has a graded item', () => {
    renderCourses(
      [
        { id: 'a', code: 'CS 101', title: 'Intro', color: 'bg-blue-500', credits: 4 },
        { id: 'b', code: 'MATH 201', title: 'Calc II', color: 'bg-green-500', credits: 3 },
      ],
      [
        // 90% -> A- (3.7)
        item({ id: 'a1', courseId: 'a', gradeWeight: 100, earnedScore: 90 }),
        // b has no graded work - left out of the GPA and its coverage count
      ],
    );
    expect(screen.getByText('GPA')).toBeDefined();
    expect(screen.getByText('3.70')).toBeDefined();
    expect(screen.getByText(/From 1 of 2 courses with grades entered/)).toBeDefined();
  });
});
