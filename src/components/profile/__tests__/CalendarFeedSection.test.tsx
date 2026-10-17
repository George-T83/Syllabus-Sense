import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CalendarFeedSection } from '../CalendarFeedSection';
import { ToastProvider } from '@/components/ui/Toast';

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { uid: 'u1', getIdToken: () => Promise.resolve('id-token') } }),
}));

const TOKEN_A = 'a'.repeat(32);
const TOKEN_B = 'b'.repeat(32);

function mockFetch(handler: (method: string) => unknown) {
  const fn = vi.fn(async (_url: string, init?: RequestInit) => {
    const body = handler(init?.method ?? 'GET');
    return { ok: body !== null, json: async () => body } as Response;
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

const renderSection = () =>
  render(
    <ToastProvider>
      <CalendarFeedSection />
    </ToastProvider>,
  );

describe('CalendarFeedSection', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('warns that anyone with the link can see the schedule', async () => {
    mockFetch(() => ({ token: null }));
    renderSection();
    expect(await screen.findByText(/anyone with the link can see/i)).toBeTruthy();
    expect(screen.getByText(/do not share it/i)).toBeTruthy();
  });

  it('offers Create link when there is none, and shows the link after creating', async () => {
    const fetchMock = mockFetch((method) =>
      method === 'POST' ? { token: TOKEN_A } : { token: null },
    );
    renderSection();
    const create = await screen.findByText('Create link');
    await waitFor(() => expect((create as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(create);

    const input = (await screen.findByLabelText('Calendar feed link')) as HTMLInputElement;
    expect(input.value.endsWith(`/api/calendar/${TOKEN_A}`)).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/calendar/feed',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('asks for confirmation before resetting, then swaps in the new link', async () => {
    mockFetch((method) => (method === 'POST' ? { token: TOKEN_B } : { token: TOKEN_A }));
    renderSection();
    fireEvent.click(await screen.findByText('Reset link'));
    expect(screen.getByText(/old link stops working/i)).toBeTruthy();
    fireEvent.click(screen.getByText('Reset'));

    await waitFor(() => {
      const input = screen.getByLabelText('Calendar feed link') as HTMLInputElement;
      expect(input.value.endsWith(TOKEN_B)).toBe(true);
    });
  });

  it('Turn off revokes the link and goes back to Create link', async () => {
    const fetchMock = mockFetch((method) =>
      method === 'DELETE' ? { success: true } : { token: TOKEN_A },
    );
    renderSection();
    fireEvent.click(await screen.findByText('Turn off'));

    expect(await screen.findByText('Create link')).toBeTruthy();
    expect(screen.queryByLabelText('Calendar feed link')).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/calendar/feed',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('shows an unavailable note instead of buttons when the server cannot be reached', async () => {
    mockFetch(() => null);
    renderSection();
    expect(await screen.findByText(/aren.t available right now/i)).toBeTruthy();
    expect(screen.queryByText('Create link')).toBeNull();
  });
});
