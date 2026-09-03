import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { PlannerView } from '@/components/schedule/PlannerView';
import { AppStateProvider } from '@/context/AppStateContext';
import { AuthProvider } from '@/context/AuthContext';
import { ToastProvider } from '@/components/ui/Toast';
import type { Course, ScheduleItem } from '@/types/schedule';

vi.hoisted(() => {
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY =
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'mock-api-key';
  process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN =
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'mock-auth-domain';
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID =
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'mock-project-id';
});

vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(() => ({ name: '[DEFAULT]' })),
  getApps: vi.fn(() => []),
  getApp: vi.fn(() => ({ name: '[DEFAULT]' })),
}));
vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({})),
  onAuthStateChanged: vi.fn(() => () => {}),
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  signInWithPopup: vi.fn(),
  GoogleAuthProvider: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(() => ({})),
  initializeFirestore: vi.fn(() => ({})),
  doc: vi.fn(),
  setDoc: vi.fn(),
  deleteDoc: vi.fn(),
}));
vi.mock('firebase/storage', () => ({
  getStorage: vi.fn(() => ({})),
}));

const courses: Course[] = [
  { id: 'c1', code: 'CSCI 213', title: 'Computer Science I', color: 'bg-blue-500' },
  { id: 'c2', code: 'MATH 301', title: 'Linear Algebra', color: 'bg-green-500' },
];

// Due dates are relative to whenever the suite actually runs, not hardcoded
// calendar dates - a hardcoded date eventually lands in the past and flips
// items between the Overdue/In Progress/Upcoming buckets, breaking the
// 'groups by status' assertions below. Recursion HW and Midterm Exam both
// stay comfortably in the future (isOverdue only trips once dueDate < now),
// while keeping Midterm Exam's due date earlier than Recursion HW's
// preserves the due-date ordering the other tests assert on.
const DAY_MS = 24 * 60 * 60 * 1000;
function daysFromNow(days: number): string {
  return new Date(Date.now() + days * DAY_MS).toISOString();
}

const scheduleItems: ScheduleItem[] = [
  {
    id: 'i1',
    courseId: 'c1',
    title: 'Recursion HW',
    type: 'assignment',
    dueDate: daysFromNow(30),
    completed: false,
    priority: 'low',
    progress: 30,
  },
  {
    id: 'i2',
    courseId: 'c2',
    title: 'Midterm Exam',
    type: 'exam',
    dueDate: daysFromNow(10),
    completed: false,
    priority: 'high',
  },
  {
    id: 'i3',
    courseId: 'c1',
    title: 'Finished Reading',
    type: 'reading',
    dueDate: daysFromNow(-14),
    completed: true,
    priority: 'medium',
  },
];

function renderPlanner() {
  return render(
    <AuthProvider>
      <ToastProvider>
        <AppStateProvider initialState={{ courses, scheduleItems, initialized: true }}>
          <PlannerView />
        </AppStateProvider>
      </ToastProvider>
    </AuthProvider>,
  );
}

describe('PlannerView', () => {
  it('groups by due date by default, with completed items in their own group', () => {
    renderPlanner();
    // Pending items always render in due-date order regardless of which
    // date bucket (Overdue/Today/This Week/Later) they land in, and the
    // Completed bucket always renders last - so this ordering holds no
    // matter what "today" is when the test runs.
    const titles = screen
      .getAllByText(/^(Recursion HW|Midterm Exam|Finished Reading)$/)
      .map((el) => el.textContent);
    expect(titles).toEqual(['Midterm Exam', 'Recursion HW', 'Finished Reading']);
  });

  it('filters to only pending tasks', () => {
    renderPlanner();
    fireEvent.change(screen.getByDisplayValue('All Statuses'), { target: { value: 'pending' } });
    expect(screen.queryByText('Finished Reading')).toBeNull();
    expect(screen.getByText('Midterm Exam')).toBeDefined();
  });

  it('filters to a single course', () => {
    renderPlanner();
    fireEvent.change(screen.getByDisplayValue('All Courses'), { target: { value: 'c2' } });
    expect(screen.queryByText('Recursion HW')).toBeNull();
    expect(screen.getByText('Midterm Exam')).toBeDefined();
  });

  it('sorts by priority when selected, within a flat list', () => {
    renderPlanner();
    fireEvent.change(screen.getByDisplayValue('Group: Due Date'), { target: { value: 'flat' } });
    fireEvent.change(screen.getByDisplayValue('Then by: Due Date'), {
      target: { value: 'priority' },
    });
    const titles = screen
      .getAllByText(/^(Recursion HW|Midterm Exam|Finished Reading)$/)
      .map((el) => el.textContent);
    expect(titles).toEqual(['Midterm Exam', 'Finished Reading', 'Recursion HW']);
  });

  it('groups by course and can reorder within a course by status', () => {
    renderPlanner();
    fireEvent.change(screen.getByDisplayValue('Group: Due Date'), { target: { value: 'course' } });
    expect(screen.getByRole('heading', { name: 'CSCI 213' })).toBeDefined();
    expect(screen.getByRole('heading', { name: 'MATH 301' })).toBeDefined();

    fireEvent.change(screen.getByDisplayValue('Then by: Due Date'), {
      target: { value: 'status' },
    });
    // CSCI 213 has Recursion HW (pending) and Finished Reading (completed) -
    // sorting the course group by status should put the pending item first
    // regardless of due date.
    const csciTitles = screen
      .getAllByText(/^(Recursion HW|Finished Reading)$/)
      .map((el) => el.textContent);
    expect(csciTitles).toEqual(['Recursion HW', 'Finished Reading']);
  });

  it('groups by status into Overdue/In Progress/Upcoming/Completed', () => {
    renderPlanner();
    fireEvent.change(screen.getByDisplayValue('Group: Due Date'), { target: { value: 'status' } });
    // Recursion HW has progress > 0 and isn't overdue, so it lands in
    // "In Progress" rather than "Upcoming" - distinct from Midterm Exam,
    // which has no progress logged.
    expect(screen.getByRole('heading', { name: 'In Progress' })).toBeDefined();
    expect(screen.getByRole('heading', { name: 'Upcoming' })).toBeDefined();
    expect(screen.getByRole('heading', { name: 'Completed' })).toBeDefined();
  });

  it('shows an empty state when no tasks match the filters', () => {
    renderPlanner();
    fireEvent.change(screen.getByDisplayValue('All Types'), { target: { value: 'quiz' } });
    expect(screen.getByText('No tasks match these filters')).toBeDefined();
  });
});
