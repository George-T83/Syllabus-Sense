import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MoodRecapView } from '../MoodRecapView';
import { AppStateProvider } from '@/context/AppStateContext';
import type { MoodEntry } from '@/types/mood';
import type { ScheduleItem } from '@/types/schedule';

// Recharts sizes itself from a ResizeObserver, which jsdom lacks. The charts
// themselves draw nothing at 0x0; what is asserted here is the text and
// links around them.
class StubResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

function entry(dateKey: string, mood: 1 | 2 | 3 | 4): MoodEntry {
  return { id: dateKey, dateKey, mood, createdAt: `${dateKey}T12:00:00.000Z` };
}

function renderRecap(moodEntries: MoodEntry[], scheduleItems: ScheduleItem[] = []) {
  return render(
    <AppStateProvider initialState={{ moodEntries, scheduleItems }}>
      <MoodRecapView />
    </AppStateProvider>,
  );
}

function tile(label: string): HTMLElement {
  return screen.getByText(label).parentElement as HTMLElement;
}

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', StubResizeObserver);
  // Thursday 10 September 2026, local noon.
  vi.useFakeTimers({ toFake: ['Date'], now: new Date(2026, 8, 10, 12, 0, 0) });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('MoodRecapView with no check-ins', () => {
  it('invites the student to check in from the dashboard and shows no stats', () => {
    renderRecap([]);
    expect(screen.getByText('No check-ins yet')).toBeDefined();
    expect(screen.getByText(/Tap a mood on your dashboard each day/)).toBeDefined();
    expect(screen.getByRole('button', { name: 'Go to Dashboard' })).toBeDefined();
    expect(screen.queryByText('Current streak')).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Your mood over time' })).toBeNull();
  });
});

describe('MoodRecapView stats', () => {
  const entries = [
    entry('2026-09-06', 1),
    entry('2026-09-07', 2),
    entry('2026-09-08', 3),
    entry('2026-09-09', 4),
    entry('2026-09-10', 4),
  ];

  it('counts check-ins and the current streak', () => {
    renderRecap(entries);
    expect(within(tile('Check-ins')).getByText('5')).toBeDefined();
    expect(within(tile('Current streak')).getByText('5d')).toBeDefined();
  });

  it('shows the average as a face plus the number', () => {
    renderRecap(entries);
    // (1 + 2 + 3 + 4 + 4) / 5 = 2.8, which rounds to Good.
    const average = tile('Average mood');
    expect(within(average).getByText('2.8')).toBeDefined();
    expect(within(average).getByText('🙂')).toBeDefined();
  });

  it('breaks a streak at a missed day', () => {
    renderRecap([entry('2026-09-05', 3), entry('2026-09-06', 3), entry('2026-09-10', 3)]);
    expect(within(tile('Current streak')).getByText('1d')).toBeDefined();
  });

  it('keeps yesterday-ending streaks alive until the day is over', () => {
    renderRecap([entry('2026-09-08', 3), entry('2026-09-09', 3)]);
    expect(within(tile('Current streak')).getByText('2d')).toBeDefined();
  });

  it('reports a zero streak when the latest check-in is older than yesterday', () => {
    renderRecap([entry('2026-09-01', 3)]);
    expect(within(tile('Current streak')).getByText('0d')).toBeDefined();
  });

  it('names the best and toughest day, preferring the more recent on a tie', () => {
    renderRecap(entries);
    const best = screen.getByText('Your best day').parentElement as HTMLElement;
    expect(within(best).getByText('😄')).toBeDefined();
    expect(within(best).getByText('Thu, Sep 10')).toBeDefined();
    const worst = screen.getByText('Your toughest day').parentElement as HTMLElement;
    expect(within(worst).getByText('😫')).toBeDefined();
    expect(within(worst).getByText('Sun, Sep 6')).toBeDefined();
    expect(within(tile('Best day')).getByText('Sep 10')).toBeDefined();
  });

  it('labels the three sections', () => {
    renderRecap(entries);
    expect(screen.getByRole('heading', { name: 'Your mood over time' })).toBeDefined();
    expect(screen.getByRole('heading', { name: 'Mood by workload level' })).toBeDefined();
    expect(screen.getByRole('heading', { name: 'Your check-in history' })).toBeDefined();
  });
});

describe('MoodRecapView check-in history', () => {
  it('links every checked-in day to Calendar with a descriptive name', () => {
    renderRecap([entry('2026-09-08', 2), entry('2026-09-10', 4)]);
    const first = screen.getByRole('link', {
      name: 'Open Tue, Sep 8 in Calendar - felt okay',
    });
    expect(first.getAttribute('href')).toBe('/calendar?date=2026-09-08');
    const second = screen.getByRole('link', {
      name: 'Open Thu, Sep 10 in Calendar - felt great',
    });
    expect(second.getAttribute('href')).toBe('/calendar?date=2026-09-10');
  });

  it('does not make unchecked days into links', () => {
    renderRecap([entry('2026-09-08', 2), entry('2026-09-10', 4)]);
    expect(screen.getAllByRole('link')).toHaveLength(2);
  });

  it('shows the Rough to Great legend', () => {
    renderRecap([entry('2026-09-10', 4)]);
    expect(screen.getByText('Rough')).toBeDefined();
    expect(screen.getByText('Great')).toBeDefined();
  });
});
