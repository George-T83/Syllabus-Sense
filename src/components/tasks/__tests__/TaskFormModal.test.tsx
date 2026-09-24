import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TaskFormModal } from '../TaskFormModal';
import type { Course } from '@/types/schedule';

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
    code: 'BIO 201',
    title: 'Cellular Biology',
    instructor: 'Dr. Franklin',
    term: 'Fall 2026',
    // A weekly discussion section cancelled on a specific date - the
    // real, already-modeled "conflict" this feature is aware of.
    skipDates: ['2026-09-14'],
  },
];

function fillBaseFields(courseId = 'course-1') {
  fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Weekly Quiz' } });
  fireEvent.change(screen.getByLabelText('Course'), { target: { value: courseId } });
  fireEvent.change(screen.getByLabelText('Due Date'), { target: { value: '2026-09-07' } });
}

describe('TaskFormModal - Conflict-Aware Recurring Task Templates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not show the Repeat option when editing an existing task', () => {
    render(
      <TaskFormModal
        open={true}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        courses={mockCourses}
        initialItem={{
          id: 'item-1',
          courseId: 'course-1',
          title: 'Existing Task',
          type: 'assignment',
          dueDate: '2026-09-07',
          completed: false,
        }}
      />,
    );
    expect(screen.queryByText('Repeat this task')).toBeNull();
  });

  it('hides the frequency/occurrences controls until Repeat is checked', () => {
    render(
      <TaskFormModal open={true} onClose={vi.fn()} onSubmit={vi.fn()} courses={mockCourses} />,
    );
    expect(screen.queryByLabelText('Frequency')).toBeNull();
    fireEvent.click(screen.getByText('Repeat this task'));
    expect(screen.getByLabelText('Frequency')).toBeDefined();
    expect(screen.getByLabelText('Occurrences')).toBeDefined();
  });

  it('shows a shifted-count note when an occurrence would land on a skip date', () => {
    render(
      <TaskFormModal open={true} onClose={vi.fn()} onSubmit={vi.fn()} courses={mockCourses} />,
    );
    fillBaseFields('course-2');
    fireEvent.click(screen.getByText('Repeat this task'));
    fireEvent.change(screen.getByLabelText('Occurrences'), { target: { value: '2' } });

    // Occurrence 2 (2026-09-14) falls on BIO 201's skip date.
    expect(screen.getByText(/1 shifted off a skipped class date/i)).toBeDefined();
  });

  it('creates one task per occurrence, with dates shifted off skip dates, on submit', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    render(
      <TaskFormModal open={true} onClose={onClose} onSubmit={onSubmit} courses={mockCourses} />,
    );
    fillBaseFields('course-2');
    fireEvent.click(screen.getByText('Repeat this task'));
    fireEvent.change(screen.getByLabelText('Occurrences'), { target: { value: '3' } });

    fireEvent.click(screen.getByRole('button', { name: /Add 3 Tasks/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(3));
    const dueDates = onSubmit.mock.calls.map(([values]) => values.dueDate);
    // Weekly from 2026-09-07: 09-07, 09-14 (shifted off the skip date to
    // 09-15), 09-21.
    expect(dueDates).toEqual(['2026-09-07', '2026-09-15', '2026-09-21']);
    expect(onSubmit.mock.calls.every(([values]) => values.title === 'Weekly Quiz')).toBe(true);
    expect(onClose).toHaveBeenCalled();
  });

  it('creates a single task as before when Repeat is left unchecked', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <TaskFormModal open={true} onClose={vi.fn()} onSubmit={onSubmit} courses={mockCourses} />,
    );
    fillBaseFields();
    fireEvent.click(screen.getByRole('button', { name: 'Add Task' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0].dueDate).toBe('2026-09-07');
  });
});
