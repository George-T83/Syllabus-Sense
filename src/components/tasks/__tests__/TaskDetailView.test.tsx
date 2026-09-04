import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { TaskDetailView } from '../TaskDetailView';
import { AppStateProvider } from '@/context/AppStateContext';
import { ToastProvider } from '@/components/ui/Toast';
import type { ScheduleItem, Course } from '@/types/schedule';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    user: { uid: 'user-1', email: 'student@example.com' },
    loading: false,
  }),
}));

const mockCourse: Course = {
  id: 'course-1',
  code: 'CS 101',
  title: 'Intro to Computer Science',
  instructor: 'Dr. Smith',
  color: 'bg-blue-500',
  term: 'Fall 2026',
};

const mockItem: ScheduleItem = {
  id: 'task-1',
  courseId: 'course-1',
  title: 'Homework 1: Fundamentals',
  type: 'assignment',
  dueDate: '2026-09-15T23:59:00.000Z',
  priority: 'high',
  estimatedHours: 3.5,
  progress: 50,
  completed: false,
  notes: 'Review chapter 2 before starting.',
  gradeWeight: 15,
};

function renderTaskDetail(item?: ScheduleItem, course?: Course) {
  return render(
    <ToastProvider>
      <AppStateProvider
        initialState={{
          courses: course ? [course] : [],
          scheduleItems: item ? [item] : [],
        }}
      >
        <TaskDetailView taskId={item?.id ?? 'non-existent'} />
      </AppStateProvider>
    </ToastProvider>,
  );
}

describe('TaskDetailView DL Semantics and Accessibility', () => {
  it('renders semantic <dl> elements with <dt> terms and <dd> descriptions', () => {
    const { container } = renderTaskDetail(mockItem, mockCourse);

    const dls = container.querySelectorAll('dl');
    expect(dls.length).toBeGreaterThanOrEqual(2); // Metadata DL and Notes DL

    // First DL (metadata: Due & Estimated Effort)
    const metaDl = dls[0];
    const metaDts = metaDl.querySelectorAll('dt');
    const metaDds = metaDl.querySelectorAll('dd');

    expect(metaDts.length).toBe(2);
    expect(metaDds.length).toBe(2);
    expect(metaDts[0].textContent).toContain('Due');
    expect(metaDts[1].textContent).toContain('Estimated effort');

    // Second DL (Notes)
    const notesDl = dls[1];
    const notesDt = notesDl.querySelector('dt');
    const notesDd = notesDl.querySelector('dd');

    expect(notesDt?.textContent).toBe('Notes');
    expect(notesDd?.textContent).toContain('Review chapter 2 before starting.');
  });

  it('renders correctly when item has no notes without creating empty DL', () => {
    const itemWithoutNotes = { ...mockItem, notes: undefined };
    const { container } = renderTaskDetail(itemWithoutNotes, mockCourse);

    const dls = container.querySelectorAll('dl');
    expect(dls.length).toBe(1); // Only the metadata DL
    expect(dls[0].querySelector('dt')?.textContent).toContain('Due');
  });

  it('renders not-found empty state for missing task ID', () => {
    renderTaskDetail(undefined, mockCourse);
    expect(screen.getByText(/This task doesn't exist or has been removed/i)).toBeDefined();
    expect(screen.getByText('Back to tasks')).toBeDefined();
  });
});
