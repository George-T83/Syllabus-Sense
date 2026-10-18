import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MoodCheckInCard } from '../MoodCheckInCard';
import { AppStateProvider } from '@/context/AppStateContext';
import { ToastProvider } from '@/components/ui/Toast';
import type { MoodEntry } from '@/types/mood';

let mockUser: { uid: string } | null;
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: mockUser, loading: false }),
}));

// The real upsertMoodEntry runs (optimistic dispatch + rollback); only the
// Firestore SDK underneath is replaced.
vi.mock('@/lib/firebase/client', () => ({ db: {} }));
const setDoc = vi.fn();
vi.mock('firebase/firestore', () => ({
  doc: (...args: unknown[]) => args,
  setDoc: (...args: unknown[]) => setDoc(...args),
}));

// Wednesday 10 September 2026, local noon.
const NOW = new Date(2026, 8, 10, 12, 0, 0);

function entry(dateKey: string, mood: 1 | 2 | 3 | 4): MoodEntry {
  return { id: dateKey, dateKey, mood, createdAt: `${dateKey}T12:00:00.000Z` };
}

function renderCard(moodEntries: MoodEntry[] = []) {
  return render(
    <ToastProvider>
      <AppStateProvider initialState={{ moodEntries }}>
        <MoodCheckInCard />
      </AppStateProvider>
    </ToastProvider>,
  );
}

const face = (name: string) => screen.getByRole('button', { name }) as HTMLButtonElement;

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ['Date'], now: NOW });
  mockUser = { uid: 'user-1' };
  setDoc.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('MoodCheckInCard', () => {
  it('offers four named faces, none selected, and a link to the recap', () => {
    renderCard();
    expect(screen.getByRole('heading', { name: "How's today going?" })).toBeDefined();
    for (const name of ['Rough', 'Okay', 'Good', 'Great']) {
      expect(face(name).getAttribute('aria-pressed')).toBe('false');
    }
    expect(screen.getByRole('link', { name: 'See your recap →' }).getAttribute('href')).toBe(
      '/mood',
    );
    expect(screen.queryByText(/Logged as/)).toBeNull();
  });

  it('saves today as the tapped mood and marks it pressed', async () => {
    renderCard();
    fireEvent.click(face('Good'));
    await waitFor(() => expect(face('Good').getAttribute('aria-pressed')).toBe('true'));
    expect(face('Rough').getAttribute('aria-pressed')).toBe('false');
    expect(setDoc).toHaveBeenCalledTimes(1);
    expect(setDoc.mock.calls[0][1]).toMatchObject({
      id: '2026-09-10',
      dateKey: '2026-09-10',
      mood: 3,
    });
    expect(screen.getByText('Logged as Good today - tap another face to change it.')).toBeDefined();
  });

  it('shows an already-logged mood from earlier today', () => {
    renderCard([entry('2026-09-10', 4)]);
    expect(face('Great').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText(/Logged as Great today/)).toBeDefined();
  });

  it('lets the student change their mind, replacing rather than adding', async () => {
    renderCard([entry('2026-09-10', 4)]);
    fireEvent.click(face('Rough'));
    await waitFor(() => expect(face('Rough').getAttribute('aria-pressed')).toBe('true'));
    expect(face('Great').getAttribute('aria-pressed')).toBe('false');
    expect(setDoc.mock.calls[0][1]).toMatchObject({ id: '2026-09-10', mood: 1 });
  });

  it('disables the faces while a save is in flight', async () => {
    let resolveSave!: () => void;
    setDoc.mockReturnValue(new Promise<void>((r) => (resolveSave = r)));
    renderCard();
    fireEvent.click(face('Okay'));
    await waitFor(() => expect(face('Great').disabled).toBe(true));
    resolveSave();
    await waitFor(() => expect(face('Great').disabled).toBe(false));
  });

  it('reports a failed save and puts back the previous selection', async () => {
    setDoc.mockRejectedValue(new Error('offline'));
    renderCard([entry('2026-09-10', 2)]);
    fireEvent.click(face('Great'));
    expect(await screen.findByText("Couldn't save your check-in")).toBeDefined();
    expect(screen.getByText('Try tapping again in a moment.')).toBeDefined();
    expect(face('Okay').getAttribute('aria-pressed')).toBe('true');
    expect(face('Great').getAttribute('aria-pressed')).toBe('false');
    expect(face('Great').disabled).toBe(false);
  });

  it('removes a first-ever check-in again when its save fails', async () => {
    setDoc.mockRejectedValue(new Error('offline'));
    renderCard();
    fireEvent.click(face('Good'));
    await screen.findByText("Couldn't save your check-in");
    expect(face('Good').getAttribute('aria-pressed')).toBe('false');
    expect(screen.queryByText(/Logged as/)).toBeNull();
  });

  it('does nothing when signed out', () => {
    mockUser = null;
    renderCard();
    fireEvent.click(face('Good'));
    expect(setDoc).not.toHaveBeenCalled();
  });

  describe('streak', () => {
    it('stays hidden for a single check-in', () => {
      renderCard([entry('2026-09-10', 3)]);
      expect(screen.queryByText(/check-in streak/)).toBeNull();
    });

    it('counts consecutive days ending today', () => {
      renderCard([entry('2026-09-08', 3), entry('2026-09-09', 2), entry('2026-09-10', 4)]);
      expect(screen.getByText('3-day check-in streak')).toBeDefined();
    });

    it('does not reset just because today is not logged yet', () => {
      renderCard([entry('2026-09-08', 3), entry('2026-09-09', 2)]);
      expect(screen.getByText('2-day check-in streak')).toBeDefined();
    });

    it('resets after a missed day', () => {
      renderCard([entry('2026-09-06', 3), entry('2026-09-07', 3), entry('2026-09-10', 3)]);
      expect(screen.queryByText(/check-in streak/)).toBeNull();
    });

    it('grows when today is logged on top of a running streak', async () => {
      renderCard([entry('2026-09-08', 3), entry('2026-09-09', 2)]);
      fireEvent.click(face('Good'));
      expect(await screen.findByText('3-day check-in streak')).toBeDefined();
    });
  });
});
