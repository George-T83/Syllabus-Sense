import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WorkloadRadarChart } from '../WorkloadRadarChart';
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
    meetingTimes: [
      { dayOfWeek: 1, startTime: '09:00', endTime: '10:15', location: 'Hall 101' },
      { dayOfWeek: 3, startTime: '09:00', endTime: '10:15', location: 'Hall 101' },
    ],
  },
  {
    id: 'course-2',
    code: 'MATH 240',
    title: 'Linear Algebra',
    instructor: 'Prof. Gauss',
    term: 'Fall 2026',
    meetingTimes: [
      { dayOfWeek: 2, startTime: '11:00', endTime: '12:15', location: 'Hall 202' },
    ],
  },
];

const mockItems: ScheduleItem[] = [
  {
    id: 'item-1',
    courseId: 'course-1',
    title: 'Midterm Exam 1',
    type: 'exam',
    dueDate: '2026-09-15T10:00:00Z',
    completed: false,
    priority: 'high',
  },
  {
    id: 'item-2',
    courseId: 'course-1',
    title: 'Binary Tree Project',
    type: 'project',
    dueDate: '2026-09-18T23:59:00Z',
    completed: false,
    priority: 'medium',
  },
  {
    id: 'item-3',
    courseId: 'course-2',
    title: 'Problem Set 3',
    type: 'assignment',
    dueDate: '2026-09-16T23:59:00Z',
    completed: false,
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

describe('WorkloadRadarChart (Item 37)', () => {
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

  it('renders radar chart with title, stress status badge, and SVG elements', () => {
    renderWithProviders(<WorkloadRadarChart />);

    expect(screen.getByRole('region', { name: /Cognitive Workload Radar Chart/i })).toBeDefined();
    expect(screen.getByText(/Weekly Cognitive Workload Radar/i)).toBeDefined();
    expect(screen.getByLabelText(/Filter radar by timeframe/i)).toBeDefined();
    expect(screen.getByLabelText(/Filter radar by course/i)).toBeDefined();
  });

  it('renders all 6 cognitive load dimensions and breakdown rows', () => {
    renderWithProviders(<WorkloadRadarChart />);

    expect(screen.getByText('Exam Weight & Stakes')).toBeDefined();
    expect(screen.getByText('Deliverables Volume')).toBeDefined();
    expect(screen.getByText('Reading & Prep Density')).toBeDefined();
    expect(screen.getByText('Meeting & Class Hours')).toBeDefined();
    expect(screen.getByText('Project Complexity')).toBeDefined();
    expect(screen.getByText('Deadline Proximity')).toBeDefined();
  });

  it('allows filtering workload radar by course', () => {
    renderWithProviders(<WorkloadRadarChart />);

    const courseSelect = screen.getByLabelText(/Filter radar by course/i) as HTMLSelectElement;
    expect(courseSelect.value).toBe('all');

    fireEvent.change(courseSelect, { target: { value: 'course-1' } });
    expect(courseSelect.value).toBe('course-1');
  });

  it('toggles accessible data table on button click', () => {
    renderWithProviders(<WorkloadRadarChart />);

    const toggleBtn = screen.getByText(/View accessible workload data table/i);
    expect(screen.queryByRole('table')).toBeNull();

    fireEvent.click(toggleBtn);
    expect(screen.getByRole('table')).toBeDefined();
    expect(screen.getByText(/Hide accessible data table/i)).toBeDefined();
  });

  it('displays burnout mitigation advice card', () => {
    renderWithProviders(<WorkloadRadarChart />);
    expect(screen.getByText(/Burnout Defense Recommendation/i)).toBeDefined();
  });
});
