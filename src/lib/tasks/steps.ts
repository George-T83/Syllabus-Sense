import type { TaskStep } from '@/types/schedule';

export const MAX_STEPS = 30;
export const MAX_STEP_TITLE_LENGTH = 120;

/** A new step, or null for blank text or a full list. Titles are trimmed and clipped. */
export function addStep(
  steps: TaskStep[] | undefined,
  title: string,
  id: string = crypto.randomUUID(),
): TaskStep[] | null {
  const current = steps ?? [];
  const clean = title.trim().slice(0, MAX_STEP_TITLE_LENGTH);
  if (!clean || current.length >= MAX_STEPS) return null;
  return [...current, { id, title: clean, done: false }];
}

export function toggleStep(steps: TaskStep[] | undefined, id: string): TaskStep[] {
  return (steps ?? []).map((s) => (s.id === id ? { ...s, done: !s.done } : s));
}

export function removeStep(steps: TaskStep[] | undefined, id: string): TaskStep[] {
  return (steps ?? []).filter((s) => s.id !== id);
}

export function stepCounts(steps: TaskStep[] | undefined): { done: number; total: number } {
  const list = steps ?? [];
  return { done: list.filter((s) => s.done).length, total: list.length };
}

/**
 * The completion percentage the steps imply (0-100, whole numbers), or
 * undefined when there are no steps - so a task without steps keeps whatever
 * progress the student set by hand.
 */
export function progressFromSteps(steps: TaskStep[] | undefined): number | undefined {
  const { done, total } = stepCounts(steps);
  if (total === 0) return undefined;
  return Math.round((done / total) * 100);
}
