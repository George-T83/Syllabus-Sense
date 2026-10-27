import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { CoursesListView } from '../CoursesListView';
import { AppStateProvider } from '@/context/AppStateContext';
import { ToastProvider } from '@/components/ui/Toast';
import type { Course, ScheduleItem } from '@/types/schedule';
import type { Term } from '@/types/term';

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { uid: 'user-1', email: 'student@example.com' }, loading: false }),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

function item(o: Partial<ScheduleItem> & { id: string; courseId: string }): ScheduleItem {
  return { title: o.id, type: 'assignment', dueDate: '2026-09-01', completed: true, ...o };
}

function renderCourses(
  courses: Course[],
  scheduleItems: ScheduleItem[] = [],
  extra: { terms?: Term[]; selectedTerm?: string | null; initialized?: boolean } = {},
) {
  return render(
    <ToastProvider>
      <AppStateProvider initialState={{ courses, scheduleItems, ...extra }}>
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
    expect(screen.getByText(/An estimate, not your official GPA/)).toBeDefined();
  });
});

describe('CoursesListView accessibility', () => {
  it('gives the search box an accessible name', () => {
    renderCourses([{ id: 'a', code: 'CS 101', title: 'Intro', color: 'bg-blue-500' }]);
    expect(screen.getByRole('textbox', { name: 'Search courses' })).toBeTruthy();
  });
});

describe('CoursesListView terms', () => {
  const fall: Term = {
    id: 't-fall',
    label: 'Fall 2026',
    startDate: '2026-08-24',
    endDate: '2026-12-18',
  };
  const spring: Term = {
    id: 't-spring',
    label: 'Spring 2027',
    startDate: '2027-01-12',
    endDate: '2027-05-15',
  };
  const courses: Course[] = [
    {
      id: 'a',
      code: 'CS 101',
      title: 'Intro',
      color: 'bg-blue-500',
      termId: 't-fall',
      term: 'Fall 2026',
    },
    {
      id: 'b',
      code: 'MATH 201',
      title: 'Calc II',
      color: 'bg-green-500',
      termId: 't-spring',
      term: 'Spring 2027',
    },
    // Not linked to a term object yet: matched through its label.
    { id: 'c', code: 'ENGL 110', title: 'Comp', color: 'bg-rose-500', term: 'Fall 2026' },
  ];

  it('filters by the active term object, including a course that only has the label', () => {
    renderCourses(courses, [], {
      terms: [spring, fall],
      selectedTerm: 't-fall',
      initialized: true,
    });
    expect(screen.getByText('CS 101')).toBeTruthy();
    expect(screen.getByText('ENGL 110')).toBeTruthy();
    expect(screen.queryByText('MATH 201')).toBeNull();
    expect(screen.getByText(/1 more course in other terms/)).toBeTruthy();
  });

  it('lists the term objects in the filter, earliest first, and shows every term for "All Terms"', () => {
    renderCourses(courses, [], { terms: [spring, fall], selectedTerm: 'all', initialized: true });
    const filter = screen.getByLabelText('Filter by term');
    expect(
      within(filter)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['All Terms', 'Fall 2026', 'Spring 2027']);
    expect(screen.getByText('MATH 201')).toBeTruthy();
  });

  it('labels each course with its term object’s label', () => {
    renderCourses(courses, [], { terms: [spring, fall], selectedTerm: 'all', initialized: true });
    expect(screen.getAllByText('Spring 2027').length).toBeGreaterThan(0);
  });
});
