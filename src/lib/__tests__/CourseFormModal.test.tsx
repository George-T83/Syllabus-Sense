import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { CourseFormModal } from '@/components/courses/CourseFormModal';
import { AppStateProvider } from '@/context/AppStateContext';
import type { Course } from '@/types/schedule';

function renderModal(ui: React.ReactElement) {
  return render(<AppStateProvider initialState={{ courses: [] }}>{ui}</AppStateProvider>);
}

describe('CourseFormModal', () => {
  it('renders nothing when closed', () => {
    const { container } = renderModal(
      <CourseFormModal open={false} onClose={vi.fn()} onSubmit={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('blocks submit and shows errors when required fields are empty', async () => {
    const onSubmit = vi.fn();
    renderModal(<CourseFormModal open onClose={vi.fn()} onSubmit={onSubmit} />);

    fireEvent.click(screen.getByRole('button', { name: 'Add Course' }));

    expect(await screen.findByText('Course code is required')).toBeDefined();
    expect(screen.getByText('Course title is required')).toBeDefined();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('clears a field error as soon as the user retypes it (regression: errors used to stick)', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    renderModal(<CourseFormModal open onClose={vi.fn()} onSubmit={onSubmit} />);

    fireEvent.click(screen.getByRole('button', { name: 'Add Course' }));
    expect(await screen.findByText('Course code is required')).toBeDefined();

    fireEvent.change(screen.getByLabelText('Course Code'), { target: { value: 'CSCI 213' } });
    expect(screen.queryByText('Course code is required')).toBeNull();
  });

  it('submits parsed values and closes on success', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    renderModal(<CourseFormModal open onClose={onClose} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText('Course Code'), { target: { value: 'CSCI 213' } });
    fireEvent.change(screen.getByLabelText('Course Title'), {
      target: { value: 'Computer Science I' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add Course' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      code: 'CSCI 213',
      title: 'Computer Science I',
    });
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it('shows a submit error and stays open when onSubmit rejects', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('Firestore is not configured.'));
    const onClose = vi.fn();
    renderModal(<CourseFormModal open onClose={onClose} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText('Course Code'), { target: { value: 'CSCI 213' } });
    fireEvent.change(screen.getByLabelText('Course Title'), { target: { value: 'Intro' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Course' }));

    expect(await screen.findByText('Firestore is not configured.')).toBeDefined();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('pre-fills fields from initialCourse for editing', () => {
    const course: Course = {
      id: 'c1',
      code: 'MATH 301',
      title: 'Linear Algebra',
      color: 'bg-green-500',
    };
    renderModal(
      <CourseFormModal open onClose={vi.fn()} onSubmit={vi.fn()} initialCourse={course} />,
    );

    expect((screen.getByLabelText('Course Code') as HTMLInputElement).value).toBe('MATH 301');
    expect((screen.getByLabelText('Course Title') as HTMLInputElement).value).toBe(
      'Linear Algebra',
    );
    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeDefined();
  });
});
