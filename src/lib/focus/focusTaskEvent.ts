/**
 * Focus Mode Deep Link: a one-tap "focus on this task" action from the
 * Calendar needs to open the Pomodoro widget - which lives once, globally,
 * in LayoutWrapper - pre-scoped to a specific task. LayoutWrapper already
 * has a `pomodoroOpenSignal` mechanism for the CommandPalette's "Start
 * Pomodoro" action, but that has no task to scope to and no path for a
 * deeply-nested page to reach the layout's state directly.
 *
 * A plain browser CustomEvent is the simplest bridge for that: no new
 * context provider, no prop drilling through every page between Calendar
 * and the root layout, and no URL/query-param + Suspense-boundary
 * complexity for a global client component this large. One dispatch, one
 * listener.
 */

export const FOCUS_TASK_EVENT = 'syllabus-sense:focus-task';

export interface FocusTaskEventDetail {
  taskId: string;
}

export function dispatchFocusTask(taskId: string): void {
  window.dispatchEvent(
    new CustomEvent<FocusTaskEventDetail>(FOCUS_TASK_EVENT, { detail: { taskId } }),
  );
}
