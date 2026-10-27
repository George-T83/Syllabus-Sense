import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TermForm } from '../TermForm';
import type { Term } from '@/types/term';

const fall: Term = {
  id: 't-fall',
  label: 'Fall 2026',
  startDate: '2026-08-24',
  endDate: '2026-12-18',
};

function setup(props: Partial<React.ComponentProps<typeof TermForm>> = {}) {
  const onSave = vi.fn().mockResolvedValue(undefined);
  const onCancel = vi.fn();
  render(<TermForm existingTerms={[]} onSave={onSave} onCancel={onCancel} {...props} />);
  return { onSave, onCancel };
}
const value = (label: string) => (screen.getByLabelText(label) as HTMLInputElement).value;

describe('TermForm', () => {
  it('starts a known label with its usual dates, as a suggestion to confirm', () => {
    setup({ suggestedLabel: 'Fall 2026' });
    expect(value('Term name')).toBe('Fall 2026');
    expect(value('First day')).toBe('2026-08-24');
    expect(value('Last day')).toBe('2026-12-18');
    expect(screen.getByTestId('term-standard-hint')).toBeTruthy();
  });

  it('starts an unknown label with no dates and says so', () => {
    setup({ suggestedLabel: 'Winter 2027' });
    expect(value('First day')).toBe('');
    expect(screen.getByTestId('term-no-standard-hint')).toBeTruthy();
  });

  it('follows the usual dates as the label is typed, until the student sets a date', () => {
    setup();
    fireEvent.change(screen.getByLabelText('Term name'), { target: { value: 'Spring 2027' } });
    expect(value('First day')).toBe('2027-01-12');
    fireEvent.change(screen.getByLabelText('Term name'), { target: { value: 'Summer 2027' } });
    expect(value('Last day')).toBe('2027-08-14');
    // Typed over to something with no usual dates: the suggestion goes away.
    fireEvent.change(screen.getByLabelText('Term name'), { target: { value: 'Block 3' } });
    expect(value('First day')).toBe('');
  });

  it('keeps a date the student changed when the label changes', () => {
    setup({ suggestedLabel: 'Fall 2026' });
    fireEvent.change(screen.getByLabelText('Last day'), { target: { value: '2026-12-11' } });
    fireEvent.change(screen.getByLabelText('Term name'), { target: { value: 'Spring 2027' } });
    expect(value('Last day')).toBe('2026-12-11');
  });

  it('saves the confirmed term with a new id, or keeps the id when editing', async () => {
    const created = setup({ suggestedLabel: 'Fall 2026' });
    fireEvent.click(screen.getByRole('button', { name: 'Save term' }));
    await waitFor(() => expect(created.onSave).toHaveBeenCalledTimes(1));
    expect(created.onSave.mock.calls[0][0]).toMatchObject({
      label: 'Fall 2026',
      startDate: '2026-08-24',
      endDate: '2026-12-18',
    });
    expect(created.onSave.mock.calls[0][0].id).toBeTruthy();
  });

  it('edits a stored term in place', async () => {
    document.body.innerHTML = '';
    const { onSave } = setup({ initialTerm: fall });
    fireEvent.change(screen.getByLabelText('Last day'), { target: { value: '2026-12-11' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save term' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ ...fall, endDate: '2026-12-11' }));
  });

  it('does not let a stored term be renamed, since its name is copied onto courses', () => {
    setup({ initialTerm: fall });
    const name = screen.getByLabelText('Term name') as HTMLInputElement;
    expect(name.readOnly).toBe(true);
    fireEvent.change(name, { target: { value: 'Other' } });
    expect(name.value).toBe('Fall 2026');
  });

  it('shows why a term cannot be saved and does not save it', () => {
    const { onSave } = setup({ suggestedLabel: 'Winter 2027' });
    fireEvent.click(screen.getByRole('button', { name: 'Save term' }));
    expect(screen.getByRole('alert').textContent).toMatch(/first and a last day/);
    fireEvent.change(screen.getByLabelText('Term name'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save term' }));
    expect(screen.getByRole('alert').textContent).toMatch(/Give the term a name/);
    expect(onSave).not.toHaveBeenCalled();
  });

  it('saves on Enter in a field, but Enter on Cancel only cancels', async () => {
    const { onSave, onCancel } = setup({ suggestedLabel: 'Fall 2026' });
    fireEvent.keyDown(screen.getByRole('button', { name: 'Cancel' }), { key: 'Enter' });
    expect(onSave).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(screen.getByLabelText('Term name'), { key: 'Enter' });
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
  });

  it('shows a save failure to the student', async () => {
    const { onSave } = setup({ suggestedLabel: 'Fall 2026' });
    onSave.mockRejectedValueOnce(new Error('offline'));
    fireEvent.click(screen.getByRole('button', { name: 'Save term' }));
    expect((await screen.findByRole('alert')).textContent).toBe('offline');
  });
});
