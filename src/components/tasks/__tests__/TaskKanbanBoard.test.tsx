import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TaskKanbanBoard } from '../TaskKanbanBoard';
import { AppStateProvider, AppState } from '@/context/AppStateContext';
import { ThemeProvider } from '@/context/ThemeProvider';
import type { Course, ScheduleItem } from '@/types/schedule';

const mockCourses: Course[] = [
  {
    id: 'course-1',
    code: 'CS 301',
    title: 'Data Structures',
    instructor: 'Dr. Ada Lovelace',
    term: 'Fall 2026',
  },
  {
    id: 'course-2',
    code: 'MATH 240',
    title: 'Linear Algebra',
    instructor: 'Prof. Gauss',
    term: 'Fall 2026',
  },
];

const mockItems: ScheduleItem[] = [
  {
    id: 'task-1',
    courseId: 'course-1',
    title: 'Homework 1: Stacks & Queues',
    type: 'assignment',
    dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(), // Due in 2 days (this_week)
    completed: false,
    priority: 'high',
  },
  {
    id: 'task-2',
    courseId: 'course-1',
    title: 'Final Project Submission',
    type: 'project',
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // Due in 30 days (backlog)
    completed: false,
    priority: 'medium',
  },
  {
    id: 'task-3',
    courseId: 'course-2',
    title: 'Syllabus Quiz',
    type: 'quiz',
    dueDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // Completed
    completed: true,
    priority: 'low',
  },
];

function renderWithProviders(ui: React.ReactElement, stateOverrides: Partial<AppState> = {}) {
  const initialState: Partial<AppState> = {
    courses: mockCourses,
    scheduleItems: mockItems,
    contacts: [],
    selectedTerm: 'Fall 2026',
    ...stateOverrides,
  };

  return render(
    <ThemeProvider>
      <AppStateProvider initialState={initialState as AppState}>{ui}</AppStateProvider>
    </ThemeProvider>
  );
}

describe('TaskKanbanBoard (Item 38)', () => {
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

  it('renders all 4 Kanban columns (Backlog, This Week, In Progress, Completed)', () => {
    renderWithProviders(<TaskKanbanBoard />);

    expect(screen.getByRole('region', { name: /Interactive Task Kanban Board/i })).toBeDefined();
    expect(screen.getByText('Backlog & Later')).toBeDefined();
    expect(screen.getByText('Due This Week')).toBeDefined();
    expect(screen.getByText('In Progress')).toBeDefined();
    expect(screen.getByText('Completed')).toBeDefined();
  });

  it('sorts tasks automatically into correct columns based on due date and completion', () => {
    renderWithProviders(<TaskKanbanBoard />);

    expect(screen.getByText('Homework 1: Stacks & Queues')).toBeDefined();
    expect(screen.getByText('Final Project Submission')).toBeDefined();
    expect(screen.getByText('Syllabus Quiz')).toBeDefined();
  });

  it('filters tasks by course selector', () => {
    renderWithProviders(<TaskKanbanBoard />);

    const select = screen.getByLabelText(/Filter kanban by course/i) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'course-2' } });

    expect(screen.getByText('Syllabus Quiz')).toBeDefined();
    expect(screen.queryByText('Homework 1: Stacks & Queues')).toBeNull();
  });

  it('filters tasks by search input', () => {
    renderWithProviders(<TaskKanbanBoard />);

    const searchInput = screen.getByLabelText(/Search tasks in kanban/i);
    fireEvent.change(searchInput, { target: { value: 'Stacks' } });

    expect(screen.getByText('Homework 1: Stacks & Queues')).toBeDefined();
    expect(screen.queryByText('Syllabus Quiz')).toBeNull();
  });

  it('allows moving tasks between columns using directional handles', () => {
    renderWithProviders(<TaskKanbanBoard />);

    // Find move right button on task-1
    const moveRightBtn = screen.getByRole('button', { name: /Move Homework 1: Stacks & Queues right/i });
    fireEvent.click(moveRightBtn);

    // Should now be moved to in_progress
    expect(screen.getByText('Homework 1: Stacks & Queues')).toBeDefined();
  });

  it('toggles task completion when checkmark button is clicked', () => {
    renderWithProviders(<TaskKanbanBoard />);

    const checkBtn = screen.getByRole('button', { name: /Mark Homework 1: Stacks & Queues as complete/i });
    fireEvent.click(checkBtn);

    expect(screen.getByRole('button', { name: /Mark Homework 1: Stacks & Queues as incomplete/i })).toBeDefined();
  });
});
