import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CommandPalette } from '../CommandPalette';
import { AppStateProvider, AppState } from '@/context/AppStateContext';
import { ThemeProvider } from '@/context/ThemeProvider';
import type { Course, ScheduleItem } from '@/types/schedule';

const pushMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

const mockCourses: Course[] = [
  {
    id: 'course-1',
    code: 'CS 301',
    title: 'Data Structures & Algorithms',
    instructor: 'Dr. Ada Lovelace',
    meetingTimes: [
      { dayOfWeek: 1, startTime: '09:00', endTime: '10:15', location: 'Science Hall 204' },
    ],
    term: 'Fall 2026',
    color: '#3B82F6',
  },
  {
    id: 'course-2',
    code: 'MATH 240',
    title: 'Linear Algebra',
    instructor: 'Prof. Gauss',
    meetingTimes: [{ dayOfWeek: 2, startTime: '11:00', endTime: '12:15', location: 'Math 101' }],
    term: 'Fall 2026',
    color: '#10B981',
  },
];

const mockTasks: ScheduleItem[] = [
  {
    id: 'task-1',
    courseId: 'course-1',
    title: 'Implement Red-Black Trees',
    dueDate: '2026-09-15T23:59:00.000Z',
    type: 'assignment',
    priority: 'high',
    completed: false,
    gradeWeight: 15,
  },
  {
    id: 'task-2',
    courseId: 'course-2',
    title: 'Problem Set 3 Eigenvectors',
    dueDate: '2026-09-18T23:59:00.000Z',
    type: 'assignment',
    priority: 'medium',
    completed: true,
    gradeWeight: 10,
  },
];

function renderWithProviders(ui: React.ReactElement, stateOverrides: Partial<AppState> = {}) {
  const initialState: Partial<AppState> = {
    courses: mockCourses,
    scheduleItems: mockTasks,
    contacts: [],
    selectedTerm: 'Fall 2026',
    ...stateOverrides,
  };

  return render(
    <ThemeProvider>
      <AppStateProvider initialState={initialState as AppState}>{ui}</AppStateProvider>
    </ThemeProvider>,
  );
}

describe('CommandPalette (Item 34)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it('renders nothing when isOpen is false', () => {
    const { container } = renderWithProviders(<CommandPalette isOpen={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders dialog with search input and category pills when open', () => {
    renderWithProviders(<CommandPalette isOpen={true} />);

    expect(screen.getByRole('dialog')).toBeDefined();
    expect(screen.getByPlaceholderText(/Type a command/i)).toBeDefined();
    expect(screen.getByRole('button', { name: 'All' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Navigation' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Courses' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Tasks' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Actions' })).toBeDefined();
  });

  it('filters items in real-time as user types query', () => {
    renderWithProviders(<CommandPalette isOpen={true} />);

    const input = screen.getByPlaceholderText(/Type a command/i);
    fireEvent.change(input, { target: { value: 'Linear Algebra' } });

    expect(screen.getByText(/MATH 240: Linear Algebra/i)).toBeDefined();
    expect(screen.queryByText(/CS 301/i)).toBeNull();
  });

  it('allows category filter pills to narrow search results', () => {
    renderWithProviders(<CommandPalette isOpen={true} />);

    const coursesPill = screen.getByRole('button', { name: 'Courses' });
    fireEvent.click(coursesPill);

    expect(screen.getByText(/CS 301: Data Structures/i)).toBeDefined();
    expect(screen.queryByText(/Dashboard/i)).toBeNull();
  });

  it('navigates to selected item when clicked', () => {
    const onClose = vi.fn();
    renderWithProviders(<CommandPalette isOpen={true} onClose={onClose} />);

    const dashboardOption = screen.getByText('Dashboard');
    fireEvent.click(dashboardOption);

    expect(pushMock).toHaveBeenCalledWith('/');
    expect(onClose).toHaveBeenCalled();
  });

  it('supports keyboard arrows and Enter key navigation', () => {
    const onClose = vi.fn();
    renderWithProviders(<CommandPalette isOpen={true} onClose={onClose} />);

    const dialog = screen.getByRole('dialog').firstElementChild!;
    // Press ArrowDown to select next item and Enter to execute
    fireEvent.keyDown(dialog, { key: 'ArrowDown' });
    fireEvent.keyDown(dialog, { key: 'Enter' });

    expect(pushMock).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('closes when Escape key is pressed', () => {
    const onClose = vi.fn();
    renderWithProviders(<CommandPalette isOpen={true} onClose={onClose} />);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('invokes onAction callback when quick action item is selected', () => {
    const onAction = vi.fn();
    renderWithProviders(<CommandPalette isOpen={true} onAction={onAction} />);

    const themeToggle = screen.getByText(/Switch to (Dark|Light) Theme/i);
    fireEvent.click(themeToggle);

    expect(onAction).toHaveBeenCalledWith('theme-toggle');
  });
});
