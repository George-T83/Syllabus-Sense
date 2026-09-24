import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Navbar from '../Navbar';
import { AppStateProvider, AppState } from '@/context/AppStateContext';
import { ThemeProvider } from '@/context/ThemeProvider';
import { ToastProvider } from '@/components/ui/Toast';
import type { Course, ScheduleItem } from '@/types/schedule';

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    user: { uid: 'user-1', email: 'student@example.com', displayName: 'Student' },
    signOut: vi.fn(),
  }),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const NOW = new Date('2026-09-24T12:00:00.000Z');

const mockCourse: Course = {
  id: 'course-1',
  code: 'CS 301',
  title: 'Data Structures',
  instructor: 'Dr. Ada Lovelace',
  term: 'Fall 2026',
};

function itemDueIn(
  id: string,
  msFromNow: number,
  overrides: Partial<ScheduleItem> = {},
): ScheduleItem {
  return {
    id,
    courseId: 'course-1',
    title: `Task ${id}`,
    type: 'assignment',
    dueDate: new Date(NOW.getTime() + msFromNow).toISOString(),
    completed: false,
    ...overrides,
  };
}

function renderNavbar(scheduleItems: ScheduleItem[]) {
  const initialState: Partial<AppState> = { courses: [mockCourse], scheduleItems };
  return render(
    <ThemeProvider>
      <ToastProvider>
        <AppStateProvider initialState={initialState as AppState}>
          <Navbar />
        </AppStateProvider>
      </ToastProvider>
    </ThemeProvider>,
  );
}

describe('Navbar notification bell - urgency tiers', () => {
  beforeEach(() => {
    // Pin the clock so the urgency windows below are computed relative to a
    // known "now" instead of whatever the real system clock reads at test
    // run time - otherwise a "due in 1 hour" fixture can silently land in
    // the past (and the overdue bucket) once enough wall-clock time passes.
    vi.useFakeTimers({ now: NOW });
    // jsdom does not implement matchMedia; ThemeProvider needs it to resolve
    // 'system' theme on mount.
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('sorts an overdue item, a today item, a this-week item, and a high-stakes item into distinct tiers', () => {
    renderNavbar([
      itemDueIn('overdue-1', -60_000, { title: 'Overdue Task' }),
      itemDueIn('today-1', 60 * 60 * 1000, { title: 'Today Task' }),
      itemDueIn('week-1', 3 * 24 * 60 * 60 * 1000, { title: 'This Week Task' }),
      itemDueIn('stakes-1', 10 * 24 * 60 * 60 * 1000, {
        title: 'High Stakes Task',
        gradeWeight: 40,
      }),
    ]);

    fireEvent.click(screen.getByRole('button', { name: /notifications/i }));

    expect(screen.getByText('Overdue')).toBeDefined();
    expect(screen.getByText('Overdue Task')).toBeDefined();
    expect(screen.getByText('Due today')).toBeDefined();
    expect(screen.getByText('Today Task')).toBeDefined();
    expect(screen.getByText('Due this week')).toBeDefined();
    expect(screen.getByText('This Week Task')).toBeDefined();
    expect(screen.getByText('High-stakes ahead')).toBeDefined();
    expect(screen.getByText('High Stakes Task')).toBeDefined();
  });

  it('does not surface a low-weight item beyond the due-this-week window', () => {
    renderNavbar([
      itemDueIn('far-1', 10 * 24 * 60 * 60 * 1000, { title: 'Far Off Task', gradeWeight: 5 }),
    ]);

    fireEvent.click(screen.getByRole('button', { name: /notifications/i }));

    expect(screen.getByText('Nothing overdue or coming up.')).toBeDefined();
    expect(screen.queryByText('Far Off Task')).toBeNull();
  });

  it('shows the empty state when there is nothing overdue or upcoming', () => {
    renderNavbar([]);
    fireEvent.click(screen.getByRole('button', { name: /notifications/i }));
    expect(screen.getByText('Nothing overdue or coming up.')).toBeDefined();
  });
});
