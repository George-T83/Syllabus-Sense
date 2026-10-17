import { describe, it, expect } from 'vitest';
import {
  MAX_STEPS,
  MAX_STEP_TITLE_LENGTH,
  addStep,
  progressFromSteps,
  removeStep,
  stepCounts,
  toggleStep,
} from '../steps';
import type { TaskStep } from '@/types/schedule';

const step = (id: string, done = false): TaskStep => ({ id, title: `Step ${id}`, done });

describe('addStep', () => {
  it('appends a trimmed, unfinished step', () => {
    const next = addStep([step('a')], '  Outline  ', 'b');
    expect(next).toEqual([step('a'), { id: 'b', title: 'Outline', done: false }]);
  });

  it('starts a list from nothing', () => {
    expect(addStep(undefined, 'First', 'x')).toEqual([{ id: 'x', title: 'First', done: false }]);
  });

  it('refuses blank text', () => {
    expect(addStep([], '   ', 'x')).toBeNull();
  });

  it('clips a very long title', () => {
    const next = addStep([], 'x'.repeat(500), 'x');
    expect(next?.[0].title).toHaveLength(MAX_STEP_TITLE_LENGTH);
  });

  it('refuses to go past the limit', () => {
    const full = Array.from({ length: MAX_STEPS }, (_, i) => step(String(i)));
    expect(addStep(full, 'one more', 'z')).toBeNull();
  });
});

describe('toggle and remove', () => {
  it('flips only the chosen step and leaves the original list alone', () => {
    const list = [step('a'), step('b')];
    const next = toggleStep(list, 'b');
    expect(next.map((s) => s.done)).toEqual([false, true]);
    expect(list[1].done).toBe(false);
  });

  it('ignores an unknown id', () => {
    expect(toggleStep([step('a')], 'nope')).toEqual([step('a')]);
  });

  it('removes a step', () => {
    expect(removeStep([step('a'), step('b')], 'a')).toEqual([step('b')]);
  });

  it('copes with no list at all', () => {
    expect(toggleStep(undefined, 'a')).toEqual([]);
    expect(removeStep(undefined, 'a')).toEqual([]);
  });
});

describe('progress from steps', () => {
  it('counts done and total', () => {
    expect(stepCounts([step('a', true), step('b'), step('c', true)])).toEqual({
      done: 2,
      total: 3,
    });
    expect(stepCounts(undefined)).toEqual({ done: 0, total: 0 });
  });

  it('is the rounded share done', () => {
    expect(progressFromSteps([step('a', true), step('b'), step('c')])).toBe(33);
    expect(progressFromSteps([step('a', true), step('b', true), step('c')])).toBe(67);
    expect(progressFromSteps([step('a', true), step('b', true)])).toBe(100);
    expect(progressFromSteps([step('a'), step('b')])).toBe(0);
  });

  it('is undefined with no steps, so hand-set progress is left alone', () => {
    expect(progressFromSteps([])).toBeUndefined();
    expect(progressFromSteps(undefined)).toBeUndefined();
  });
});
