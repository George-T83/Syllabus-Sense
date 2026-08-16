import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { TaskFormModal } from '@/components/tasks/TaskFormModal';
import type { Course, ScheduleItem } from '@/types/schedule';

const course: Course = { id: 'c1', code: 'CSCI 213', title: 'Computer Science I' };

describe('TaskFormModal', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <TaskFormModal open={false} onClose={vi.fn()} onSubmit={vi.fn()} courses={[course]} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('prompts to add a course first when there are none', () => {
    render(<TaskFormModal open onClose={vi.fn()} onSubmit={vi.fn()} courses={[]} />);
    expect(screen.getByText('Add a course first before creating tasks for it.')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Add Task' })).toHaveProperty('disabled', true);
  });

  it('blocks submit and shows an error when title and due date are empty', async () => {
    const onSubmit = vi.fn();
    render(<TaskFormModal open onClose={vi.fn()} onSubmit={onSubmit} courses={[course]} />);

    fireEvent.click(screen.getByRole('button', { name: 'Add Task' }));

    expect(await screen.findByText('Title is required')).toBeDefined();
    expect(screen.getByText('Due date is required')).toBeDefined();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits with the default course, type, and priority pre-selected', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<TaskFormModal open onClose={vi.fn()} onSubmit={onSubmit} courses={[course]} />);

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Recursion HW' } });
    fireEvent.change(screen.getByLabelText('Due Date'), { target: { value: '2026-09-01' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Task' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      title: 'Recursion HW',
      courseId: 'c1',
      type: 'assignment',
      priority: 'medium',
      dueDate: '2026-09-01',
    });
  });

  it('rejects a negative estimated-hours value', async () => {
    const onSubmit = vi.fn();
    render(<TaskFormModal open onClose={vi.fn()} onSubmit={onSubmit} courses={[course]} />);

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Reading' } });
    fireEvent.change(screen.getByLabelText('Due Date'), { target: { value: '2026-09-01' } });
    fireEvent.change(screen.getByLabelText('Est. Hours'), { target: { value: '-3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Task' }));

    expect(await screen.findByText('Enter a positive number')).toBeDefined();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('pre-fills fields from initialItem for editing', () => {
    const item: ScheduleItem = {
      id: 'i1',
      courseId: 'c1',
      title: 'Midterm Exam',
      type: 'exam',
      dueDate: '2026-10-15T14:00:00.000Z',
      completed: false,
      priority: 'high',
    };
    render(
      <TaskFormModal
        open
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        courses={[course]}
        initialItem={item}
      />,
    );

    expect((screen.getByLabelText('Title') as HTMLInputElement).value).toBe('Midterm Exam');
    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeDefined();
  });
});
