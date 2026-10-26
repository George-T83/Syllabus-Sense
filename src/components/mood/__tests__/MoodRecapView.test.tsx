import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import { MoodRecapView } from '../MoodRecapView';

const push = vi.fn();
const mockUpdatePreferences = vi.fn().mockResolvedValue(undefined);
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { uid: 'u1' }, loading: false }),
}));
vi.mock('@/lib/firestore/preferences', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/firestore/preferences')>()),
  updateUserPreferences: (...args: unknown[]) => mockUpdatePreferences(...args),
}));
import { AppStateProvider } from '@/context/AppStateContext';
import type { MoodEntry } from '@/types/mood';
import type { ScheduleItem, Course } from '@/types/schedule';

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

function renderRecap(
  moodEntries: MoodEntry[],
  scheduleItems: ScheduleItem[] = [],
  extra: Partial<React.ComponentProps<typeof AppStateProvider>['initialState']> = {},
) {
  return render(
    <AppStateProvider initialState={{ moodEntries, scheduleItems, ...extra }}>
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
  it('sends the student to the dashboard through the router, not a full page load', () => {
    renderRecap([]);
    fireEvent.click(screen.getByRole('button', { name: 'Go to Dashboard' }));
    expect(push).toHaveBeenCalledWith('/dashboard');
  });

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

function gridCells(): HTMLElement[] {
  const grid = screen.getByTestId('checkin-grid');
  return Array.from(grid.children).filter(
    (el) => el.getAttribute('data-phase') || el.tagName === 'A',
  ) as HTMLElement[];
}

function item(id: string, dueDate: string): ScheduleItem {
  return {
    id,
    courseId: 'c1',
    title: id,
    type: 'assignment',
    dueDate,
    completed: false,
    priority: 'medium',
  } as ScheduleItem;
}

describe('MoodRecapView full-semester grid', () => {
  // The clock is Thursday 10 September 2026, so with no courses the active
  // term is the standard Fall 2026: Aug 24 to Dec 18, 117 days.
  it('spans the whole semester with a single check-in', () => {
    renderRecap([entry('2026-09-10', 4)]);
    expect(gridCells()).toHaveLength(117);
    expect(screen.getByTestId('semester-span').textContent).toContain(
      'Fall 2026 · Aug 24 – Dec 18',
    );
    expect(screen.getByTestId('semester-span').textContent).toContain('Standard dates');
  });

  it('does not depend on due dates', () => {
    renderRecap([entry('2026-09-10', 4)], [item('a', '2026-09-12'), item('b', '2026-09-14')]);
    expect(gridCells()).toHaveLength(117);
  });

  it('draws days still to come differently from past days with no check-in', () => {
    renderRecap([entry('2026-09-10', 4)]);
    const cells = gridCells();
    const phases = (p: string) => cells.filter((c) => c.getAttribute('data-phase') === p);
    // Aug 24 to Sep 9 is 17 past days; Sep 10 is today with a check-in (a link).
    expect(phases('past')).toHaveLength(17);
    expect(phases('future')).toHaveLength(117 - 17 - 1);
    const past = phases('past')[0];
    const future = phases('future')[0];
    expect(future.className).toContain('border-dashed');
    expect(past.className).not.toContain('border-dashed');
    expect(past.className).toContain('bg-muted-foreground/15');
    expect(future.className).not.toContain('bg-muted-foreground/15');
  });

  it('rings today until it has a check-in', () => {
    renderRecap([entry('2026-09-09', 3)]);
    const today = gridCells().find((c) => c.getAttribute('data-phase') === 'today');
    expect(today?.className).toContain('ring-2');
  });

  it('uses the active term of the courses, not the clock', () => {
    const course = {
      id: 'c1',
      code: 'ENGL 110',
      title: 'Composition',
      term: 'Spring 2027',
    } as Course;
    renderRecap([entry('2026-09-10', 4)], [], { courses: [course] });
    expect(screen.getByTestId('semester-span').textContent).toContain(
      'Spring 2027 · Jan 12 – May 15',
    );
    // Spring 2027 has not started, so every day is still to come.
    expect(gridCells().every((c) => c.getAttribute('data-phase') === 'future')).toBe(true);
    expect(screen.getByText(/1 check-in falls outside these dates/)).toBeDefined();
  });

  it('asks for dates instead of guessing when the term has none, then draws the grid', async () => {
    const course = {
      id: 'c1',
      code: 'ENGL 110',
      title: 'Composition',
      term: 'Winter 2027',
    } as Course;
    renderRecap([entry('2026-09-10', 4)], [item('a', '2026-09-12')], { courses: [course] });

    expect(screen.getByTestId('semester-unknown').textContent).toContain('Winter 2027');
    expect(screen.queryByTestId('checkin-grid')).toBeNull();

    fireEvent.change(screen.getByLabelText('First day of Winter 2027'), {
      target: { value: '2027-01-04' },
    });
    fireEvent.change(screen.getByLabelText('Last day of Winter 2027'), {
      target: { value: '2027-03-19' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save dates' }));

    expect(await screen.findByTestId('checkin-grid')).toBeDefined();
    expect(screen.getByTestId('semester-span').textContent).toContain(
      'Winter 2027 · Jan 4 – Mar 19',
    );
    expect(screen.getByTestId('semester-span').textContent).toContain('Your dates');
    // Jan 4 to Mar 19 2027 inclusive: 28 + 28 + 19 = 75 days.
    expect(gridCells()).toHaveLength(75);
    expect(mockUpdatePreferences).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({
        semesterDates: { 'Winter 2027': { start: '2027-01-04', end: '2027-03-19' } },
      }),
    );
  });

  it('rejects a last day before the first day with a message', () => {
    const course = {
      id: 'c1',
      code: 'ENGL 110',
      title: 'Composition',
      term: 'Winter 2027',
    } as Course;
    renderRecap([entry('2026-09-10', 4)], [], { courses: [course] });
    fireEvent.change(screen.getByLabelText('First day of Winter 2027'), {
      target: { value: '2027-03-19' },
    });
    fireEvent.change(screen.getByLabelText('Last day of Winter 2027'), {
      target: { value: '2027-01-04' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save dates' }));
    expect(screen.getByRole('alert').textContent).toMatch(/after the first day/);
    expect(screen.queryByTestId('checkin-grid')).toBeNull();
  });

  it("lets a student adjust a standard term's dates and go back to the standard ones", async () => {
    renderRecap([entry('2026-09-10', 4)]);
    fireEvent.click(screen.getByRole('button', { name: 'Adjust dates' }));
    fireEvent.change(screen.getByLabelText('First day of Fall 2026'), {
      target: { value: '2026-09-01' },
    });
    fireEvent.change(screen.getByLabelText('Last day of Fall 2026'), {
      target: { value: '2026-12-10' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save dates' }));

    await screen.findByText('Your dates');
    // Sep 1 to Dec 10 inclusive: 30 + 31 + 30 + 10 = 101 days.
    expect(gridCells()).toHaveLength(101);

    fireEvent.click(screen.getByRole('button', { name: 'Adjust dates' }));
    fireEvent.click(screen.getByRole('button', { name: 'Use standard dates' }));
    await screen.findByText('Standard dates');
    expect(gridCells()).toHaveLength(117);
  });
});
