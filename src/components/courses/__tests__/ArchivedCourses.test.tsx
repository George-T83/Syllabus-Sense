import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { AppStateProvider, useAppState } from '@/context/AppStateContext';
import { ToastProvider } from '@/components/ui/Toast';
import { ArchivedCoursesSection } from '../ArchivedCoursesSection';
import { ArchivedCourseNotice } from '../ArchivedCourseNotice';
import type { Contact, Course, ScheduleItem } from '@/types/schedule';

const mockRestore = vi.fn();
const mockDelete = vi.fn();
vi.mock('@/lib/firestore/courses', () => ({
  archiveCourse: vi.fn(),
  restoreCourse: (...args: unknown[]) => mockRestore(...args),
  deleteCourse: (...args: unknown[]) => mockDelete(...args),
}));
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { uid: 'u1' }, loading: false }),
}));
vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

const live: Course = { id: 'live', code: 'CS 101', title: 'Intro' };
const old: Course = {
  id: 'old',
  code: 'MATH 201',
  title: 'Linear Algebra',
  term: 'Fall 2026',
  archivedAt: '2026-10-31T15:00:00.000Z',
};
const items = [
  { id: 't1', courseId: 'old', title: 'Midterm' },
  { id: 't2', courseId: 'old', title: 'Quiz' },
  { id: 't3', courseId: 'live', title: 'Essay' },
] as ScheduleItem[];
const contacts = [{ id: 'c1', courseId: 'old', fullName: 'Dr. Haddad' }] as Contact[];

let ctx: ReturnType<typeof useAppState>;
function Probe() {
  ctx = useAppState();
  return <span data-testid="active">{ctx.state.courses.map((c) => c.code).join(',')}</span>;
}
function mount(ui: React.ReactElement, courses: Course[] = [live, old]) {
  return render(
    <ToastProvider>
      <AppStateProvider initialState={{ courses, scheduleItems: items, contacts }}>
        {ui}
        <Probe />
      </AppStateProvider>
    </ToastProvider>,
  );
}

beforeEach(() => {
  mockRestore
    .mockReset()
    .mockImplementation(async (_uid: string, course: Course, dispatch: (a: unknown) => void) => {
      const restored = { ...course };
      delete restored.archivedAt;
      dispatch({ type: 'UPDATE_COURSE', payload: restored });
    });
  mockDelete
    .mockReset()
    .mockImplementation(
      async (_uid: string, course: Course, _i: unknown, dispatch: (a: unknown) => void) => {
        dispatch({ type: 'REMOVE_COURSE', payload: course.id });
        return { failedFiles: 0 };
      },
    );
});

describe('ArchivedCoursesSection', () => {
  it('shows nothing when no course is archived', () => {
    mount(<ArchivedCoursesSection />, [live]);
    expect(screen.queryByTestId('archived-courses')).toBeNull();
  });

  it('lists each archived course with its term, date archived and what it holds, and not the courses in use', () => {
    mount(<ArchivedCoursesSection />);
    const section = screen.getByTestId('archived-courses');
    expect(within(section).getByText('MATH 201')).toBeTruthy();
    expect(within(section).queryByText('CS 101')).toBeNull();
    expect(section.textContent).toContain('Archived (1)');
    expect(section.textContent).toContain('Fall 2026 · Archived Oct 31 · 2 tasks and 1 contact');
  });

  it('restores in one tap, with no confirmation, and the course is back in use', async () => {
    mount(<ArchivedCoursesSection />);
    expect(screen.getByTestId('active').textContent).toBe('CS 101');
    fireEvent.click(screen.getByRole('button', { name: 'Restore MATH 201' }));
    await waitFor(() => expect(screen.getByTestId('active').textContent).toBe('CS 101,MATH 201'));
    expect(mockRestore).toHaveBeenCalledTimes(1);
    expect(mockRestore.mock.calls[0][1]).toMatchObject({ id: 'old' });
    // The section empties itself once nothing is archived.
    expect(screen.queryByTestId('archived-courses')).toBeNull();
  });

  it('asks before deleting forever, then removes the course with its own tasks and contacts only', async () => {
    mount(<ArchivedCoursesSection />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete MATH 201 forever' }));
    expect(mockDelete).not.toHaveBeenCalled();
    expect(screen.getByText('Delete MATH 201 for good?')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Delete forever' }));
    await waitFor(() => expect(mockDelete).toHaveBeenCalledTimes(1));
    const [, course, courseItems, , courseContacts] = mockDelete.mock.calls[0];
    expect(course.id).toBe('old');
    expect(courseItems.map((i: ScheduleItem) => i.id)).toEqual(['t1', 't2']);
    expect(courseContacts.map((c: Contact) => c.id)).toEqual(['c1']);
    await waitFor(() => expect(screen.queryByTestId('archived-courses')).toBeNull());
  });

  it('lets the student back out of Delete forever', () => {
    mount(<ArchivedCoursesSection />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete MATH 201 forever' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('button', { name: 'Restore MATH 201' })).toBeTruthy();
    expect(mockDelete).not.toHaveBeenCalled();
  });
});

describe('ArchivedCourseNotice', () => {
  it('says the course is archived and what is kept, and restores it with one tap', async () => {
    mount(<ArchivedCourseNotice course={old} />);
    expect(screen.getByRole('heading', { name: 'MATH 201 is archived' })).toBeTruthy();
    expect(screen.getByTestId('archived-course-notice').textContent).toContain(
      '2 tasks and 1 contact',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Restore course' }));
    await waitFor(() => expect(screen.getByTestId('active').textContent).toBe('CS 101,MATH 201'));
  });
});
