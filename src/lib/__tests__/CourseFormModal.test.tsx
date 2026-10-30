import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { CourseFormModal } from '@/components/courses/CourseFormModal';
import { AppStateProvider } from '@/context/AppStateContext';
import type { Course } from '@/types/schedule';
import type { Term } from '@/types/term';

const mockSaveTerm = vi.fn().mockResolvedValue(undefined);
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { uid: 'u1' }, loading: false }),
}));
vi.mock('@/lib/firestore/terms', () => ({
  saveTerm: (...args: unknown[]) => mockSaveTerm(...args),
}));

const FALL: Term = {
  id: 't-fall',
  label: 'Fall 2026',
  startDate: '2026-08-24',
  endDate: '2026-12-18',
};

function renderModal(ui: React.ReactElement, terms: Term[] = [FALL]) {
  return render(<AppStateProvider initialState={{ courses: [], terms }}>{ui}</AppStateProvider>);
}

beforeEach(() => {
  mockSaveTerm.mockClear();
});

describe('CourseFormModal', () => {
  it('renders nothing when closed', () => {
    const { container } = renderModal(
      <CourseFormModal open={false} onClose={vi.fn()} onSubmit={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('keeps its overlay scrollable, so a dialog taller than a phone can reach Add Course', () => {
    renderModal(<CourseFormModal open onClose={vi.fn()} onSubmit={vi.fn()} />);
    const overlay = screen.getByRole('dialog');
    expect(overlay.className).toContain('overflow-y-auto');
    // Auto-margin centring, not items-center: the latter clips a tall dialog.
    expect(overlay.className).not.toContain('items-center');
  });

  it('puts focus on the first field when it opens', () => {
    renderModal(<CourseFormModal open onClose={vi.fn()} onSubmit={vi.fn()} />);
    expect(document.activeElement).toBe(screen.getByLabelText('Course Code'));
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
      credits: 4,
    };
    renderModal(
      <CourseFormModal open onClose={vi.fn()} onSubmit={vi.fn()} initialCourse={course} />,
    );

    expect((screen.getByLabelText('Course Code') as HTMLInputElement).value).toBe('MATH 301');
    expect((screen.getByLabelText('Course Title') as HTMLInputElement).value).toBe(
      'Linear Algebra',
    );
    expect((screen.getByLabelText('Credit Hours') as HTMLInputElement).value).toBe('4');
    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeDefined();
  });

  it('rejects an out-of-range credit count', async () => {
    const onSubmit = vi.fn();
    renderModal(<CourseFormModal open onClose={vi.fn()} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText('Course Code'), { target: { value: 'CSCI 213' } });
    fireEvent.change(screen.getByLabelText('Course Title'), { target: { value: 'Intro' } });
    fireEvent.change(screen.getByLabelText('Credit Hours'), { target: { value: '15' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Course' }));

    expect(await screen.findByText('Enter 1-12')).toBeDefined();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits a set credit count as a number', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    renderModal(<CourseFormModal open onClose={vi.fn()} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText('Course Code'), { target: { value: 'CSCI 213' } });
    fireEvent.change(screen.getByLabelText('Course Title'), { target: { value: 'Intro' } });
    fireEvent.change(screen.getByLabelText('Credit Hours'), { target: { value: '4' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Course' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ credits: '4' });
  });

  describe('term picker', () => {
    const base = { code: 'CSCI 213', title: 'Intro' };
    const fill = () => {
      fireEvent.change(screen.getByLabelText('Course Code'), { target: { value: base.code } });
      fireEvent.change(screen.getByLabelText('Course Title'), { target: { value: base.title } });
    };

    it('offers the stored terms and submits the chosen term id', async () => {
      const onSubmit = vi.fn().mockResolvedValue(undefined);
      renderModal(<CourseFormModal open onClose={vi.fn()} onSubmit={onSubmit} />);
      fill();
      fireEvent.change(screen.getByLabelText('Term'), { target: { value: 't-fall' } });
      fireEvent.click(screen.getByRole('button', { name: 'Add Course' }));
      await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
      expect(onSubmit.mock.calls[0][0]).toMatchObject({ termId: 't-fall' });
    });

    it('creates a term from the picker with the usual dates to confirm, then selects it', async () => {
      const onSubmit = vi.fn().mockResolvedValue(undefined);
      renderModal(<CourseFormModal open onClose={vi.fn()} onSubmit={onSubmit} />, []);
      fill();
      fireEvent.change(screen.getByLabelText('Term'), { target: { value: '__new__' } });

      fireEvent.change(screen.getByLabelText('Term name'), { target: { value: 'Spring 2027' } });
      expect((screen.getByLabelText('First day') as HTMLInputElement).value).toBe('2027-01-12');
      expect((screen.getByLabelText('Last day') as HTMLInputElement).value).toBe('2027-05-15');
      expect(mockSaveTerm).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole('button', { name: 'Save term' }));
      await waitFor(() => expect(mockSaveTerm).toHaveBeenCalledTimes(1));
      const saved = mockSaveTerm.mock.calls[0][1] as Term;
      expect(saved).toMatchObject({
        label: 'Spring 2027',
        startDate: '2027-01-12',
        endDate: '2027-05-15',
      });

      // The new term is selected for the course (the select gains it once the
      // store echoes it back; here the store is mocked, so it is the value).
      await waitFor(() => expect(screen.queryByLabelText('Term name')).toBeNull());
    });

    it('never overwrites dates the student typed when the label changes', () => {
      renderModal(<CourseFormModal open onClose={vi.fn()} onSubmit={vi.fn()} />, []);
      fireEvent.change(screen.getByLabelText('Term'), { target: { value: '__new__' } });
      fireEvent.change(screen.getByLabelText('Term name'), { target: { value: 'Fall 2026' } });
      fireEvent.change(screen.getByLabelText('First day'), { target: { value: '2026-09-01' } });
      fireEvent.change(screen.getByLabelText('Term name'), { target: { value: 'Spring 2027' } });
      expect((screen.getByLabelText('First day') as HTMLInputElement).value).toBe('2026-09-01');
    });

    it('rejects a term whose label a stored term already has', async () => {
      renderModal(<CourseFormModal open onClose={vi.fn()} onSubmit={vi.fn()} />);
      fireEvent.change(screen.getByLabelText('Term'), { target: { value: '__new__' } });
      fireEvent.change(screen.getByLabelText('Term name'), { target: { value: ' fall 2026 ' } });
      fireEvent.click(screen.getByRole('button', { name: 'Save term' }));
      expect((await screen.findByRole('alert')).textContent).toMatch(/already have a term called/);
      expect(mockSaveTerm).not.toHaveBeenCalled();
    });

    it('keeps a course’s own term label when its term has no dates yet', async () => {
      const onSubmit = vi.fn().mockResolvedValue(undefined);
      const course: Course = { id: 'c1', code: 'ENGL 110', title: 'Comp', term: 'Winter 2027' };
      renderModal(
        <CourseFormModal open onClose={vi.fn()} onSubmit={onSubmit} initialCourse={course} />,
      );
      const select = screen.getByLabelText('Term') as HTMLSelectElement;
      expect(select.value).toBe('__legacy__');
      expect(screen.getByRole('option', { name: 'Winter 2027 (needs dates)' })).toBeDefined();
      fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
      await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
      expect(onSubmit.mock.calls[0][0]).toMatchObject({ termId: '__legacy__' });
    });

    it('starts an existing course on its linked term', () => {
      const course: Course = {
        id: 'c1',
        code: 'A 1',
        title: 'A',
        termId: 't-fall',
        term: 'Fall 2026',
      };
      renderModal(
        <CourseFormModal open onClose={vi.fn()} onSubmit={vi.fn()} initialCourse={course} />,
      );
      expect((screen.getByLabelText('Term') as HTMLSelectElement).value).toBe('t-fall');
    });
  });
});
