import { describe, it, expect } from 'vitest';
import { clampProgress, getTaskStatus } from '@/lib/taskStatus';

describe('clampProgress', () => {
  it('passes through an in-range value', () => {
    expect(clampProgress(40)).toBe(40);
  });

  it('clamps above 100 and below 0', () => {
    expect(clampProgress(150)).toBe(100);
    expect(clampProgress(-10)).toBe(0);
  });

  it('treats NaN as 0 rather than propagating it', () => {
    expect(clampProgress(Number.NaN)).toBe(0);
  });
});

describe('getTaskStatus', () => {
  it('is not_started when neither completed nor progress is set', () => {
    expect(getTaskStatus({ completed: false })).toBe('not_started');
    expect(getTaskStatus({ completed: false, progress: 0 })).toBe('not_started');
  });

  it('is in_progress once progress is above 0 and the task is still open', () => {
    expect(getTaskStatus({ completed: false, progress: 1 })).toBe('in_progress');
    expect(getTaskStatus({ completed: false, progress: 99 })).toBe('in_progress');
  });

  it('is completed whenever `completed` is true, regardless of progress', () => {
    expect(getTaskStatus({ completed: true, progress: 0 })).toBe('completed');
    expect(getTaskStatus({ completed: true, progress: 40 })).toBe('completed');
    expect(getTaskStatus({ completed: true })).toBe('completed');
  });
});
