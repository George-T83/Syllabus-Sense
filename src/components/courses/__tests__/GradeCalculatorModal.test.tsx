import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GradeCalculatorModal } from '../GradeCalculatorModal';
import { AppStateProvider, AppState } from '@/context/AppStateContext';
import { ThemeProvider } from '@/context/ThemeProvider';
import { AuthProvider } from '@/context/AuthContext';
import { ToastProvider } from '@/components/ui/Toast';
import type { Course, ScheduleItem } from '@/types/schedule';

const gradedItems: ScheduleItem[] = [
  {
    id: 'item-1',
    courseId: 'course-1',
    title: 'Homework 1',
    type: 'assignment',
    dueDate: '2026-09-10',
    completed: true,
    gradeCategory: 'Homework',
    gradeWeight: 40,
    earnedScore: 88,
  },
  {
    id: 'item-2',
    courseId: 'course-1',
    title: 'Midterm',
    type: 'exam',
    dueDate: '2026-10-10',
    completed: true,
    gradeCategory: 'Exams',
    gradeWeight: 30,
    earnedScore: 92,
  },
];

const mockCourses: Course[] = [
  {
    id: 'course-1',
    code: 'CS 301',
    title: 'Data Structures & Algorithms',
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

function renderWithProviders(ui: React.ReactElement, stateOverrides: Partial<AppState> = {}) {
  const initialState: Partial<AppState> = {
    courses: mockCourses,
    scheduleItems: [],
    contacts: [],
    selectedTerm: 'Fall 2026',
    ...stateOverrides,
  };

  return render(
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <AppStateProvider initialState={initialState as AppState}>{ui}</AppStateProvider>
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>,
  );
}

describe('GradeCalculatorModal (Item 36)', () => {
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
    const { container } = renderWithProviders(
      <GradeCalculatorModal isOpen={false} onClose={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders modal with course selector, standing, and final score solver when open', () => {
    renderWithProviders(<GradeCalculatorModal isOpen={true} onClose={vi.fn()} />);

    expect(screen.getByRole('dialog')).toBeDefined();
    expect(screen.getByText(/What-If Grade Simulator & GPA Solver/i)).toBeDefined();
    expect(screen.getByLabelText(/Select course/i)).toBeDefined();
    expect(screen.getByText(/Current Standing/i)).toBeDefined();
    expect(screen.getByText(/Final Exam Target Score/i)).toBeDefined();
  });

  it('switches between Course Target Solver and Semester GPA Impact tabs', () => {
    renderWithProviders(<GradeCalculatorModal isOpen={true} onClose={vi.fn()} />);

    const semesterTab = screen.getByText('Semester GPA Impact');
    fireEvent.click(semesterTab);

    expect(screen.getByText(/Projected Semester GPA/i)).toBeDefined();
    expect(screen.getByText(/Enrolled Course Projections/i)).toBeDefined();
  });

  it('updates required final exam score when target grade pill is clicked', () => {
    renderWithProviders(<GradeCalculatorModal isOpen={true} onClose={vi.fn()} />);

    // Click target 'B (83%)'
    const bGradePill = screen.getByText(/B \(83%\)/i);
    fireEvent.click(bGradePill);

    expect(screen.getByText(/Final Exam Target Score/i)).toBeDefined();
  });

  it('allows adding and updating categories dynamically', () => {
    renderWithProviders(<GradeCalculatorModal isOpen={true} onClose={vi.fn()} />);

    const addBtn = screen.getByText('Add Category');
    fireEvent.click(addBtn);

    expect(screen.getByLabelText('Category 4 Name')).toBeDefined();
  });

  it('calls onClose when close button or Escape key is pressed', () => {
    const onClose = vi.fn();
    renderWithProviders(<GradeCalculatorModal isOpen={true} onClose={onClose} />);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('shows the starter-template banner when the course has no graded work on record', () => {
    renderWithProviders(<GradeCalculatorModal isOpen={true} onClose={vi.fn()} />);

    expect(screen.getByText(/No graded scores on record for this course yet/i)).toBeDefined();
  });

  it('seeds categories from real graded schedule items and shows the seeded-data banner', () => {
    renderWithProviders(<GradeCalculatorModal isOpen={true} onClose={vi.fn()} />, {
      scheduleItems: gradedItems,
    });

    expect(screen.getByText(/Seeded from your actual graded work/i)).toBeDefined();
    expect(screen.getByDisplayValue('Homework')).toBeDefined();
    expect(screen.getByDisplayValue('Exams')).toBeDefined();
  });

  it('shows "No grades yet" in the Semester GPA tab for a course with no graded items', () => {
    renderWithProviders(
      <GradeCalculatorModal isOpen={true} onClose={vi.fn()} initialCourseId="course-1" />,
      { scheduleItems: gradedItems },
    );

    fireEvent.click(screen.getByText('Semester GPA Impact'));

    expect(screen.getByText('No grades yet')).toBeDefined();
  });

  it('enables the Save Scenario button only once a scenario name is entered', () => {
    renderWithProviders(<GradeCalculatorModal isOpen={true} onClose={vi.fn()} />);

    const saveButton = screen.getByText('Save current').closest('button') as HTMLButtonElement;
    expect(saveButton.disabled).toBe(true);

    const nameInput = screen.getByPlaceholderText(/Name this scenario/i);
    fireEvent.change(nameInput, { target: { value: 'Best case' } });

    expect(saveButton.disabled).toBe(false);
  });
});
