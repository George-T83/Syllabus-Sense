import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { loadSessions } from '@/lib/focus/pomodoroSessions';
import { PomodoroTimer, formatTime } from '../PomodoroTimer';
import { AppStateProvider, AppState } from '@/context/AppStateContext';
import type { ScheduleItem } from '@/types/schedule';

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { uid: 'u1' } }),
}));

const mockTask: ScheduleItem = {
  id: 'task-1',
  courseId: 'course-1',
  title: 'Read Chapter 5',
  type: 'reading',
  dueDate: '2026-09-10',
  completed: false,
};

const mockAppState = {
  scheduleItems: [mockTask],
  courses: [],
  contacts: [],
} as Partial<AppState> as AppState;

function renderWithState(props: { taskId?: string; openSignal?: number }) {
  return render(
    <AppStateProvider initialState={mockAppState}>
      <PomodoroTimer {...props} />
    </AppStateProvider>,
  );
}

describe('PomodoroTimer - Focus Mode Deep Link', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the focused task title once opened with a matching taskId', () => {
    const { rerender } = renderWithState({ taskId: 'task-1', openSignal: 0 });
    // Force-open by incrementing openSignal, same mechanism the
    // CommandPalette's "Start Pomodoro" action already uses.
    rerender(
      <AppStateProvider initialState={mockAppState}>
        <PomodoroTimer taskId="task-1" openSignal={1} />
      </AppStateProvider>,
    );

    expect(screen.getByText('Read Chapter 5')).toBeDefined();
    expect(screen.getByText(/Focusing on/)).toBeDefined();
  });

  it('renders no task-focused subtitle for a generic (non-task-scoped) open', () => {
    const { rerender } = renderWithState({ openSignal: 0 });
    rerender(
      <AppStateProvider initialState={mockAppState}>
        <PomodoroTimer openSignal={1} />
      </AppStateProvider>,
    );

    expect(screen.queryByText(/Focusing on/)).toBeNull();
  });

  it('renders nothing extra when the given taskId does not match any known task', () => {
    const { rerender } = renderWithState({ taskId: 'not-a-real-task', openSignal: 0 });
    rerender(
      <AppStateProvider initialState={mockAppState}>
        <PomodoroTimer taskId="not-a-real-task" openSignal={1} />
      </AppStateProvider>,
    );

    expect(screen.queryByText(/Focusing on/)).toBeNull();
  });
});

describe('formatTime', () => {
  it('formats under an hour as MM:SS', () => {
    expect(formatTime(0)).toBe('00:00');
    expect(formatTime(59)).toBe('00:59');
    expect(formatTime(25 * 60)).toBe('25:00');
    expect(formatTime(59 * 60 + 59)).toBe('59:59');
  });

  it('switches to H:MM:SS from an hour on', () => {
    expect(formatTime(60 * 60)).toBe('1:00:00');
    expect(formatTime(65 * 60)).toBe('1:05:00');
    expect(formatTime(9 * 3600 + 59 * 60 + 59)).toBe('9:59:59');
  });
});

describe('PomodoroTimer - focus mode', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.localStorage.clear();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function openTimer() {
    const view = renderWithState({ openSignal: 0 });
    view.rerender(
      <AppStateProvider initialState={mockAppState}>
        <PomodoroTimer openSignal={1} />
      </AppStateProvider>,
    );
    return view;
  }
  const click = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }));
  const run = (ms: number) => act(() => void vi.advanceTimersByTime(ms));

  it('hides the page behind a focus view when a session starts, and Escape brings it back', () => {
    openTimer();
    expect(screen.queryByTestId('focus-view')).toBeNull();
    click('Start timer');
    expect(screen.getByTestId('focus-view')).toBeDefined();
    expect(screen.getByRole('dialog', { name: 'Focus session' })).toBeDefined();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByTestId('focus-view')).toBeNull();
    // The clock is still running: the panel offers Pause, not Start.
    expect(screen.getByRole('button', { name: 'Pause timer' })).toBeDefined();
  });

  it('keeps the page visible when "Hide the page while I focus" is off', () => {
    window.localStorage.setItem(
      'syllabus-sense-focus-settings',
      JSON.stringify({ workMinutes: 25, breakMinutes: 5, dimPage: false }),
    );
    openTimer();
    click('Start timer');
    expect(screen.queryByTestId('focus-view')).toBeNull();
  });

  it('starts a five-minute session from "Just 5 minutes"', () => {
    openTimer();
    click('Just 5 minutes');
    expect(screen.getByTestId('focus-view').textContent).toContain('05:00');
    run(60_000);
    expect(screen.getByTestId('focus-view').textContent).toContain('04:00');
  });

  it('changes the focus length from the options and remembers it', () => {
    openTimer();
    expect(screen.getAllByText('25:00').length).toBeGreaterThan(0);
    click('Options');
    click('45 min');
    expect(screen.getAllByText('45:00').length).toBeGreaterThan(0);
    expect(JSON.parse(window.localStorage.getItem('syllabus-sense-focus-settings')!)).toMatchObject(
      {
        workMinutes: 45,
      },
    );
  });

  it('credits a session stopped after five minutes, for the time actually spent', () => {
    openTimer();
    click('Start timer');
    run(12 * 60_000);
    click('Stop session');
    const saved = loadSessions('u1');
    expect(saved).toHaveLength(1);
    expect(saved[0].duration).toBe(12 * 60);
  });

  it('credits nothing for a session stopped inside five minutes', () => {
    openTimer();
    click('Start timer');
    run(2 * 60_000);
    click('Stop session');
    expect(loadSessions('u1')).toHaveLength(0);
  });

  it('credits a full session when the clock runs out, and moves on to the break', () => {
    openTimer();
    click('Just 5 minutes');
    run(5 * 60_000 + 1000);
    const saved = loadSessions('u1');
    expect(saved).toHaveLength(1);
    expect(saved[0].duration).toBe(5 * 60);
    expect(screen.queryByTestId('focus-view')).toBeNull();
    expect(screen.getByText('Break')).toBeDefined();
  });

  it('keeps counting from the clock, not from how many ticks ran', () => {
    openTimer();
    click('Start timer');
    // One long gap, as a throttled background tab would produce.
    act(() => {
      vi.setSystemTime(Date.now() + 10 * 60_000);
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByTestId('focus-view').textContent).toContain('14:59');
  });
});
