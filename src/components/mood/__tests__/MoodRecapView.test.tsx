import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within, fireEvent, waitFor } from '@testing-library/react';
import { MoodRecapView } from '../MoodRecapView';

const push = vi.fn();
const mockSaveTerm = vi.fn().mockResolvedValue(undefined);
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { uid: 'u1' }, loading: false }),
}));
vi.mock('@/lib/firestore/terms', () => ({
  saveTerm: (...args: unknown[]) => mockSaveTerm(...args),
}));
import { AppStateProvider } from '@/context/AppStateContext';
import type { MoodEntry } from '@/types/mood';
import type { ScheduleItem, Course } from '@/types/schedule';
import type { Term } from '@/types/term';

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

const FALL: Term = {
  id: 't-fall',
  label: 'Fall 2026',
  startDate: '2026-08-24',
  endDate: '2026-12-18',
};

function renderRecap(
  moodEntries: MoodEntry[],
  scheduleItems: ScheduleItem[] = [],
  extra: Partial<React.ComponentProps<typeof AppStateProvider>['initialState']> = {},
) {
  return render(
    <AppStateProvider initialState={{ moodEntries, scheduleItems, terms: [FALL], ...extra }}>
      <MoodRecapView />
    </AppStateProvider>,
  );
}

function tile(label: string): HTMLElement {
  return screen.getByText(label).parentElement as HTMLElement;
}

beforeEach(() => {
  mockSaveTerm.mockClear();
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

describe('MoodRecapView full-term grid', () => {
  // The clock is Thursday 10 September 2026 and the student's term is Fall
  // 2026, Aug 24 to Dec 18: 117 days.
  const spring: Term = {
    id: 't-spring',
    label: 'Spring 2027',
    startDate: '2027-01-12',
    endDate: '2027-05-15',
  };

  it("spans the term's whole run with a single check-in", () => {
    renderRecap([entry('2026-09-10', 4)]);
    expect(gridCells()).toHaveLength(117);
    expect(screen.getByTestId('term-span').textContent).toBe('Fall 2026 · Aug 24 – Dec 18');
  });

  it('does not depend on due dates', () => {
    renderRecap([entry('2026-09-10', 4)], [item('a', '2026-09-12'), item('b', '2026-09-14')]);
    expect(gridCells()).toHaveLength(117);
  });

  it("draws a term of any length from the term's own dates", () => {
    const winter: Term = {
      id: 't-w',
      label: 'Winter 2027',
      startDate: '2027-01-04',
      endDate: '2027-03-19',
    };
    renderRecap([entry('2026-09-10', 4)], [], { terms: [winter] });
    expect(gridCells()).toHaveLength(75);
    expect(screen.getByTestId('term-span').textContent).toBe('Winter 2027 · Jan 4 – Mar 19');
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

  it("draws the active term of the student's courses", () => {
    const course = { id: 'c1', code: 'ENGL 110', title: 'Comp', termId: 't-spring' } as Course;
    renderRecap([entry('2026-09-10', 4)], [], { terms: [FALL, spring], courses: [course] });
    expect(screen.getByTestId('term-span').textContent).toBe('Spring 2027 · Jan 12 – May 15');
    // Spring 2027 has not started, so every day is still to come.
    expect(gridCells().every((c) => c.getAttribute('data-phase') === 'future')).toBe(true);
    expect(screen.getByText(/1 check-in falls outside these dates/)).toBeDefined();
  });

  it('draws the term chosen in the switcher', () => {
    renderRecap([entry('2026-09-10', 4)], [], { terms: [FALL, spring], selectedTerm: 't-spring' });
    expect(screen.getByTestId('term-span').textContent).toContain('Spring 2027');
  });

  it('still draws a term when "All Terms" is selected, naming the one it drew', () => {
    renderRecap([entry('2026-09-10', 4)], [], { terms: [FALL, spring], selectedTerm: 'all' });
    expect(screen.getByTestId('term-span').textContent).toContain('Fall 2026');
  });

  it('asks the student to create a term when there are none, with the usual dates filled in to confirm', async () => {
    renderRecap([entry('2026-09-10', 4)], [], { terms: [] });
    expect(screen.queryByTestId('checkin-grid')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Create a term/ }));

    const dialog = screen.getByRole('dialog');
    expect((within(dialog).getByLabelText('Term name') as HTMLInputElement).value).toBe(
      'Fall 2026',
    );
    expect((within(dialog).getByLabelText('First day') as HTMLInputElement).value).toBe(
      '2026-08-24',
    );
    expect((within(dialog).getByLabelText('Last day') as HTMLInputElement).value).toBe(
      '2026-12-18',
    );
    expect(within(dialog).getByTestId('term-standard-hint')).toBeDefined();
    // Nothing is stored until the student confirms.
    expect(mockSaveTerm).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Save term' }));
    await waitFor(() => expect(mockSaveTerm).toHaveBeenCalledTimes(1));
    expect(mockSaveTerm.mock.calls[0][1]).toMatchObject({
      label: 'Fall 2026',
      startDate: '2026-08-24',
      endDate: '2026-12-18',
    });
  });

  it('offers to date a course term that has no dates, starting from that label with no dates guessed', () => {
    const course = { id: 'c1', code: 'ENGL 110', title: 'Comp', term: 'Winter 2027' } as Course;
    renderRecap([entry('2026-09-10', 4)], [], { terms: [], courses: [course] });
    expect(screen.getByTestId('term-missing').textContent).toContain('Winter 2027');
    fireEvent.click(screen.getByRole('button', { name: 'Set dates for Winter 2027' }));

    const dialog = screen.getByRole('dialog');
    expect((within(dialog).getByLabelText('Term name') as HTMLInputElement).value).toBe(
      'Winter 2027',
    );
    expect((within(dialog).getByLabelText('First day') as HTMLInputElement).value).toBe('');
    expect(within(dialog).getByTestId('term-no-standard-hint')).toBeDefined();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Save term' }));
    expect(within(dialog).getByRole('alert').textContent).toMatch(/first and a last day/);
    expect(mockSaveTerm).not.toHaveBeenCalled();
  });

  it('edits the term the grid draws and keeps its id', async () => {
    renderRecap([entry('2026-09-10', 4)]);
    fireEvent.click(screen.getByRole('button', { name: 'Edit term' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Last day'), {
      target: { value: '2026-12-11' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save term' }));

    await waitFor(() => expect(mockSaveTerm).toHaveBeenCalledTimes(1));
    expect(mockSaveTerm.mock.calls[0][1]).toEqual({ ...FALL, endDate: '2026-12-11' });
  });
});
