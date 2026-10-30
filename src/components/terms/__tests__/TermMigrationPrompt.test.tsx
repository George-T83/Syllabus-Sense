import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { AppStateProvider } from '@/context/AppStateContext';
import { TermMigrationPrompt } from '../TermMigrationPrompt';
import { termIdForLabel } from '@/lib/terms/termMigration';

const mockSaveTerm = vi.fn();
vi.mock('@/lib/firestore/terms', () => ({
  saveTerm: (...args: unknown[]) => mockSaveTerm(...args),
}));
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { uid: 'u1' }, loading: false }),
}));

function mount(labels: string[]) {
  return render(
    <AppStateProvider initialState={{ terms: [] }}>
      <TermMigrationPrompt labels={labels} />
    </AppStateProvider>,
  );
}

beforeEach(() => {
  mockSaveTerm.mockReset().mockResolvedValue(undefined);
  window.localStorage.clear();
});

describe('TermMigrationPrompt', () => {
  it('shows nothing when every label already has dates', () => {
    mount([]);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('asks for the first and last day of each undated label, with no dates filled in', () => {
    mount(['Winter 2027', 'Block 3']);
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Winter 2027')).toBeDefined();
    expect(within(dialog).getByText('Block 3')).toBeDefined();
    expect(
      (within(dialog).getByLabelText('First day of Winter 2027') as HTMLInputElement).value,
    ).toBe('');
    expect((within(dialog).getByLabelText('Last day of Block 3') as HTMLInputElement).value).toBe(
      '',
    );
  });

  it('saves each filled-in label as a term the student defined, with a stable id', async () => {
    mount(['Winter 2027']);
    fireEvent.change(screen.getByLabelText('First day of Winter 2027'), {
      target: { value: '2027-01-04' },
    });
    fireEvent.change(screen.getByLabelText('Last day of Winter 2027'), {
      target: { value: '2027-03-19' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save dates' }));

    await waitFor(() => expect(mockSaveTerm).toHaveBeenCalledTimes(1));
    expect(mockSaveTerm.mock.calls[0][1]).toEqual({
      id: termIdForLabel('Winter 2027'),
      label: 'Winter 2027',
      startDate: '2027-01-04',
      endDate: '2027-03-19',
    });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('rejects dates that do not make a term and saves nothing', () => {
    mount(['Winter 2027']);
    fireEvent.change(screen.getByLabelText('First day of Winter 2027'), {
      target: { value: '2027-03-19' },
    });
    fireEvent.change(screen.getByLabelText('Last day of Winter 2027'), {
      target: { value: '2027-01-04' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save dates' }));
    expect(screen.getByRole('alert').textContent).toMatch(/Winter 2027: .*after the first day/);
    expect(mockSaveTerm).not.toHaveBeenCalled();
  });

  it('is asked once: Not now closes it and it does not come back on the next visit', () => {
    const first = mount(['Winter 2027']);
    fireEvent.click(screen.getByRole('button', { name: 'Not now' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(mockSaveTerm).not.toHaveBeenCalled();

    first.unmount();
    mount(['Winter 2027']);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('still asks about a label it has not asked about before', () => {
    const first = mount(['Winter 2027']);
    fireEvent.click(screen.getByRole('button', { name: 'Not now' }));
    first.unmount();
    mount(['Winter 2027', 'Block 3']);
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).queryByText('Winter 2027')).toBeNull();
    expect(within(dialog).getByText('Block 3')).toBeDefined();
  });
});
