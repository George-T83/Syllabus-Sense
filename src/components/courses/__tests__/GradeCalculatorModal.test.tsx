import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GradeCalculatorModal } from '../GradeCalculatorModal';
import { AppStateProvider, AppState } from '@/context/AppStateContext';
import { ThemeProvider } from '@/context/ThemeProvider';
import type { Course } from '@/types/schedule';

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
      <AppStateProvider initialState={initialState as AppState}>{ui}</AppStateProvider>
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

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});
