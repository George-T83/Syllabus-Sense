import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { AppStateProvider, useAppState } from '@/context/AppStateContext';
import { TermSwitcher } from '../TermSwitcher';
import type { Course } from '@/types/schedule';
import type { Term } from '@/types/term';

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { uid: 'u1' }, loading: false }),
}));
vi.mock('@/lib/firestore/terms', () => ({ saveTerm: vi.fn() }));

const fall: Term = {
  id: 't-fall',
  label: 'Fall 2026',
  startDate: '2026-08-24',
  endDate: '2026-12-18',
};
const spring: Term = {
  id: 't-spring',
  label: 'Spring 2027',
  startDate: '2027-01-12',
  endDate: '2027-05-15',
};
const course = (id: string, termId: string): Course =>
  ({ id, code: id, title: id, termId }) as Course;

function Selected() {
  return <span data-testid="selected">{useAppState().state.selectedTerm ?? 'none'}</span>;
}

function renderSwitcher(terms: Term[], courses: Course[] = [], selectedTerm: string | null = null) {
  return render(
    <AppStateProvider initialState={{ terms, courses, selectedTerm }}>
      <TermSwitcher />
      <Selected />
    </AppStateProvider>,
  );
}

beforeEach(() => window.localStorage.clear());

describe('TermSwitcher', () => {
  it('is hidden until there are two terms to switch between', () => {
    const { container } = renderSwitcher([fall]);
    expect(container.querySelector('button')).toBeNull();
  });

  it('shows the active term by label and lists terms earliest first', () => {
    renderSwitcher([spring, fall], [course('a', 't-fall'), course('b', 't-fall')]);
    const trigger = screen.getByRole('button', { name: 'Select term' });
    expect(trigger.textContent).toContain('Fall 2026');
    fireEvent.click(trigger);
    const options = within(screen.getByRole('listbox')).getAllByRole('option');
    expect(options.map((o) => o.textContent)).toEqual(['All Terms', 'Fall 2026', 'Spring 2027']);
  });

  it('selects a term by id, not by label', () => {
    renderSwitcher([fall, spring]);
    fireEvent.click(screen.getByRole('button', { name: 'Select term' }));
    fireEvent.click(screen.getByRole('option', { name: 'Spring 2027' }));
    expect(screen.getByTestId('selected').textContent).toBe('t-spring');
  });

  it('understands a term label an older version saved as the selection', () => {
    renderSwitcher([fall, spring], [], 'Spring 2027');
    expect(screen.getByRole('button', { name: 'Select term' }).textContent).toContain(
      'Spring 2027',
    );
  });

  it('offers to create a term, with the form asking for its first and last day', () => {
    renderSwitcher([fall, spring]);
    fireEvent.click(screen.getByRole('button', { name: 'Select term' }));
    fireEvent.click(screen.getByRole('button', { name: '+ New term…' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByLabelText('First day')).toBeTruthy();
    expect(within(dialog).getByLabelText('Last day')).toBeTruthy();
  });
});
