import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { AppStateProvider } from '@/context/AppStateContext';
import { ToastProvider } from '@/components/ui/Toast';
import { CourseDetailView } from '../CourseDetailView';
import type { Course, ScheduleItem } from '@/types/schedule';

const push = vi.fn();
const mockArchive = vi.fn();
const mockDelete = vi.fn();
const mockRestore = vi.fn();

vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { uid: 'u1', email: 's@example.com' }, loading: false }),
}));
vi.mock('@/lib/firestore/courses', () => ({
  updateCourse: vi.fn(),
  archiveCourse: (...a: unknown[]) => mockArchive(...a),
  restoreCourse: (...a: unknown[]) => mockRestore(...a),
  deleteCourse: (...a: unknown[]) => mockDelete(...a),
}));
vi.mock('@/lib/firestore/useSyllabi', () => ({ useSyllabi: () => [] }));
vi.mock('@/lib/firebase/client', () => ({ db: {}, storage: {} }));
vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  setDoc: vi.fn(),
  collection: vi.fn(),
  onSnapshot: vi.fn(() => () => {}),
  getDocs: vi.fn(),
  deleteDoc: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  writeBatch: vi.fn(),
}));
vi.mock('firebase/storage', () => ({
  ref: vi.fn(),
  uploadBytes: vi.fn(),
  getDownloadURL: vi.fn(),
  deleteObject: vi.fn(),
}));
vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

const course: Course = {
  id: 'c1',
  code: 'CSCI 213',
  title: 'Data Structures',
  color: 'bg-blue-500',
};
const items = [
  {
    id: 't1',
    courseId: 'c1',
    title: 'Problem Set 4',
    type: 'assignment',
    dueDate: '2026-11-03',
    completed: false,
  },
  {
    id: 't2',
    courseId: 'c1',
    title: 'Quiz 1',
    type: 'quiz',
    dueDate: '2026-11-05',
    completed: false,
  },
] as ScheduleItem[];

function mount(courses: Course[]) {
  return render(
    <ToastProvider>
      <AppStateProvider initialState={{ courses, scheduleItems: items, initialized: true }}>
        <CourseDetailView courseId="c1" />
      </AppStateProvider>
    </ToastProvider>,
  );
}

beforeEach(() => {
  push.mockClear();
  mockArchive.mockReset().mockResolvedValue(undefined);
  mockRestore.mockReset().mockResolvedValue(undefined);
  mockDelete.mockReset().mockResolvedValue({ failedFiles: 0 });
});

describe('deleting a course', () => {
  it('asks Archive or Delete forever instead of deleting straight away', () => {
    mount([course]);
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    const dialog = screen.getByRole('dialog', { name: 'Archive or delete CSCI 213?' });
    expect(within(dialog).getByRole('button', { name: 'Archive' })).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: 'Delete forever' })).toBeTruthy();
    expect(dialog.textContent).toContain('2 tasks');
    expect(mockArchive).not.toHaveBeenCalled();
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('archives, keeping the course, and goes to the course list', async () => {
    mount([course]);
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    fireEvent.click(screen.getByRole('button', { name: 'Archive' }));
    await waitFor(() => expect(mockArchive).toHaveBeenCalledTimes(1));
    expect(mockArchive.mock.calls[0][1]).toMatchObject({ id: 'c1', code: 'CSCI 213' });
    expect(mockDelete).not.toHaveBeenCalled();
    await waitFor(() => expect(push).toHaveBeenCalledWith('/courses'));
  });

  it('deletes forever with the course’s tasks, and goes to the dashboard', async () => {
    mount([course]);
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete forever' }));
    await waitFor(() => expect(mockDelete).toHaveBeenCalledTimes(1));
    expect(mockDelete.mock.calls[0][2].map((i: ScheduleItem) => i.id)).toEqual(['t1', 't2']);
    expect(mockArchive).not.toHaveBeenCalled();
    await waitFor(() => expect(push).toHaveBeenCalledWith('/dashboard'));
  });

  it('stays on the page, with the dialog open, if archiving fails', async () => {
    mockArchive.mockRejectedValueOnce(new Error('offline'));
    mount([course]);
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    fireEvent.click(screen.getByRole('button', { name: 'Archive' }));
    await waitFor(() => expect(mockArchive).toHaveBeenCalled());
    expect(push).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeTruthy();
  });
});

describe('an archived course’s own page', () => {
  const archived: Course = { ...course, archivedAt: '2026-10-31T15:00:00.000Z' };

  it('says it is archived and offers one-tap Restore, instead of "Course not found"', () => {
    mount([archived]);
    expect(screen.getByRole('heading', { name: 'CSCI 213 is archived' })).toBeTruthy();
    expect(screen.queryByText('Course not found')).toBeNull();
    expect(screen.getByRole('button', { name: 'Restore course' })).toBeTruthy();
  });

  it('still says "Course not found" for a course that does not exist', () => {
    mount([]);
    expect(screen.getByText('Course not found')).toBeTruthy();
  });
});
