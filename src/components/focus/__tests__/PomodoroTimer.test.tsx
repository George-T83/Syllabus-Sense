import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PomodoroTimer } from '../PomodoroTimer';
import { AppStateProvider, AppState } from '@/context/AppStateContext';
import type { ScheduleItem } from '@/types/schedule';

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
