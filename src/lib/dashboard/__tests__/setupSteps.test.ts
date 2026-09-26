import { describe, it, expect } from 'vitest';
import { setupProgress } from '../setupSteps';

describe('setupProgress', () => {
  it('starts at the first step with nothing done', () => {
    const p = setupProgress([], [], []);
    expect(p.doneCount).toBe(0);
    expect(p.next).toBe('course');
    expect(p.complete).toBe(false);
  });

  it('ticks steps off from the data itself', () => {
    const p = setupProgress([{ id: 'c' }], [{ gradeWeight: undefined }], []);
    expect(p.steps.map((s) => [s.id, s.done])).toEqual([
      ['course', true],
      ['deadlines', true],
      ['weights', false],
      ['flashcards', false],
    ]);
    expect(p.next).toBe('weights');
  });

  it('only counts a real, positive grade weight', () => {
    expect(setupProgress([{ id: 'c' }], [{ gradeWeight: 0 }], []).steps[2].done).toBe(false);
    expect(setupProgress([{ id: 'c' }], [{ gradeWeight: 15 }], []).steps[2].done).toBe(true);
  });

  it('leads with the first unfinished step even when a later one is done', () => {
    // Flashcards made before any deadline was added.
    const p = setupProgress([{ id: 'c' }], [], [{ id: 'f' }]);
    expect(p.doneCount).toBe(2);
    expect(p.next).toBe('deadlines');
  });

  it('is complete once every step is done', () => {
    const p = setupProgress([{ id: 'c' }], [{ gradeWeight: 10 }], [{ id: 'f' }]);
    expect(p.complete).toBe(true);
    expect(p.next).toBeNull();
  });
});
