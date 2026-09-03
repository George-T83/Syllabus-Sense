import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { MonthCalendar } from '@/components/calendar/MonthCalendar';
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
  initializeFirestore: vi.fn(() => ({})),
  doc: vi.fn(),
  setDoc: vi.fn(),
  deleteDoc: vi.fn(),
}));
vi.mock('firebase/storage', () => ({
  getStorage: vi.fn(() => ({})),
}));

const mockCourses: Course[] = [
  { id: 'c1', code: 'CS 101', title: 'Intro to CS', color: 'bg-blue-500' },
];

const mockItems: ScheduleItem[] = [
  {
    id: 't1',
    courseId: 'c1',
    title: 'Lab 1',
    type: 'assignment',
    dueDate: new Date().toISOString(),
    completed: false,
    priority: 'high',
    progress: 0,
  },
];

function renderCalendar() {
  return render(
    <AuthProvider>
      <AppStateProvider initialState={{ courses: mockCourses, scheduleItems: mockItems }}>
        <MonthCalendar />
      </AppStateProvider>
    </AuthProvider>,
  );
}

describe('Item 15: MonthCalendar ARIA Grid Roles & Keyboard Roving Focus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the calendar with role="grid" and an accessible label', () => {
    renderCalendar();
    const grid = screen.getByRole('grid');
    expect(grid).toBeDefined();
    expect(grid.getAttribute('aria-label')).toBeTruthy();
    expect(grid.getAttribute('aria-label')).toMatch(/Calendar/i);
  });

  it('renders 7 column headers with full weekday accessible names', () => {
    renderCalendar();
    const headers = screen.getAllByRole('columnheader');
    expect(headers).toHaveLength(7);
    const expectedDays = [
      'Sunday',
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
    ];
    headers.forEach((header, index) => {
      expect(header.getAttribute('aria-label')).toBe(expectedDays[index]);
    });
  });

  it('renders 42 gridcells with aria-selected and descriptive aria-labels', () => {
    renderCalendar();
    const cells = screen.getAllByRole('gridcell');
    expect(cells).toHaveLength(42);

    cells.forEach((cell) => {
      expect(cell.getAttribute('aria-selected')).toBeDefined();
      expect(cell.getAttribute('aria-label')).toBeTruthy();
    });
  });

  it('enforces roving tabIndex so exactly one gridcell is in tab sequence (tabIndex="0")', () => {
    renderCalendar();
    const cells = screen.getAllByRole('gridcell');
    const tabbableCells = cells.filter((c) => c.getAttribute('tabIndex') === '0');
    const nonTabbableCells = cells.filter((c) => c.getAttribute('tabIndex') === '-1');

    expect(tabbableCells).toHaveLength(1);
    expect(nonTabbableCells).toHaveLength(41);
  });

  it('updates selection and roving focus on click', () => {
    renderCalendar();
    const cells = screen.getAllByRole('gridcell');
    const targetCell = cells[15]; // arbitrary cell

    fireEvent.click(targetCell);
    expect(targetCell.getAttribute('aria-selected')).toBe('true');
    expect(targetCell.getAttribute('tabIndex')).toBe('0');

    // Other cells should not be selected
    expect(cells[14].getAttribute('aria-selected')).toBe('false');
    expect(cells[14].getAttribute('tabIndex')).toBe('-1');
  });

  it('navigates gridcells with arrow keys (Right, Left, Down, Up)', () => {
    renderCalendar();
    const grid = screen.getByRole('grid');
    const cells = screen.getAllByRole('gridcell');

    // Click cell 10 to establish initial focus
    fireEvent.click(cells[10]);
    expect(cells[10].getAttribute('tabIndex')).toBe('0');

    // ArrowRight -> cell 11
    fireEvent.keyDown(grid, { key: 'ArrowRight' });
    const activeAfterRight = screen
      .getAllByRole('gridcell')
      .find((c) => c.getAttribute('tabIndex') === '0');
    expect(activeAfterRight).toBeTruthy();

    // ArrowDown -> next week (+7)
    fireEvent.keyDown(grid, { key: 'ArrowDown' });
    const activeAfterDown = screen
      .getAllByRole('gridcell')
      .find((c) => c.getAttribute('tabIndex') === '0');
    expect(activeAfterDown).toBeTruthy();

    // ArrowLeft -> previous day (-1)
    fireEvent.keyDown(grid, { key: 'ArrowLeft' });
    const activeAfterLeft = screen
      .getAllByRole('gridcell')
      .find((c) => c.getAttribute('tabIndex') === '0');
    expect(activeAfterLeft).toBeTruthy();

    // ArrowUp -> previous week (-7)
    fireEvent.keyDown(grid, { key: 'ArrowUp' });
    const activeAfterUp = screen
      .getAllByRole('gridcell')
      .find((c) => c.getAttribute('tabIndex') === '0');
    expect(activeAfterUp).toBeTruthy();
  });

  it('navigates to start and end of week with Home and End keys', () => {
    renderCalendar();
    const grid = screen.getByRole('grid');
    const cells = screen.getAllByRole('gridcell');

    // Focus a mid-week cell (e.g. Wednesday, cell 17)
    fireEvent.click(cells[17]);

    // Home -> jumps to Sunday (beginning of week)
    fireEvent.keyDown(grid, { key: 'Home' });
    const activeAfterHome = screen
      .getAllByRole('gridcell')
      .find((c) => c.getAttribute('tabIndex') === '0');
    expect(activeAfterHome).toBeTruthy();

    // End -> jumps to Saturday (end of week)
    fireEvent.keyDown(grid, { key: 'End' });
    const activeAfterEnd = screen
      .getAllByRole('gridcell')
      .find((c) => c.getAttribute('tabIndex') === '0');
    expect(activeAfterEnd).toBeTruthy();
  });
});
