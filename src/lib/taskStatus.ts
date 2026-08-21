import type { ScheduleItem } from '@/types/schedule';

/**
 * Derived task status. `completed` is always authoritative - a task can be
 * completed with `progress` at any value (e.g. reopening a done task falls
 * back to whatever progress it last reported, rather than snapping to 0).
 */
export type TaskStatus = 'not_started' | 'in_progress' | 'completed';

/** Defensive against a hand-edited or stale Firestore doc with an
 * out-of-range value - every reader of `progress` should go through this
 * rather than trusting the stored number directly. */
export function clampProgress(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

export function getTaskStatus(item: Pick<ScheduleItem, 'completed' | 'progress'>): TaskStatus {
  if (item.completed) return 'completed';
  if (clampProgress(item.progress ?? 0) > 0) return 'in_progress';
  return 'not_started';
}

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  completed: 'Completed',
};
