import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { PlannerView } from '@/components/schedule/PlannerView';
import { AppStateProvider } from '@/context/AppStateContext';
import { AuthProvider } from '@/context/AuthContext';
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

const scheduleItems: ScheduleItem[] = [
  {
    id: 'i1',
    courseId: 'c1',
    title: 'Recursion HW',
    type: 'assignment',
    dueDate: '2026-09-10T00:00:00.000Z',
    completed: false,
    priority: 'low',
  },
  {
    id: 'i2',
    courseId: 'c2',
    title: 'Midterm Exam',
    type: 'exam',
    dueDate: '2026-09-01T00:00:00.000Z',
    completed: false,
    priority: 'high',
  },
  {
    id: 'i3',
    courseId: 'c1',
    title: 'Finished Reading',
    type: 'reading',
    dueDate: '2026-08-20T00:00:00.000Z',
    completed: true,
    priority: 'medium',
  },
];

function renderPlanner() {
  return render(
    <AuthProvider>
      <AppStateProvider initialState={{ courses, scheduleItems }}>
        <PlannerView />
      </AppStateProvider>
    </AuthProvider>,
  );
}

describe('PlannerView', () => {
  it('lists all tasks by default, sorted by due date', () => {
    renderPlanner();
    const titles = screen
      .getAllByText(/^(Recursion HW|Midterm Exam|Finished Reading)$/)
      .map((el) => el.textContent);
    expect(titles).toEqual(['Finished Reading', 'Midterm Exam', 'Recursion HW']);
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

  it('sorts by priority when selected', () => {
    renderPlanner();
    fireEvent.change(screen.getByDisplayValue('Sort: Due Date'), {
      target: { value: 'priority' },
    });
    const titles = screen
      .getAllByText(/^(Recursion HW|Midterm Exam|Finished Reading)$/)
      .map((el) => el.textContent);
    expect(titles).toEqual(['Midterm Exam', 'Finished Reading', 'Recursion HW']);
  });

  it('shows an empty state when no tasks match the filters', () => {
    renderPlanner();
    fireEvent.change(screen.getByDisplayValue('All Types'), { target: { value: 'quiz' } });
    expect(screen.getByText('No tasks match these filters')).toBeDefined();
  });
});
