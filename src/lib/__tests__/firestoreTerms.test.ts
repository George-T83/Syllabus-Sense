import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { Course } from '@/types/schedule';
import type { Term } from '@/types/term';

const batchSetMock = vi.fn();
const batchCommitMock = vi.fn();

vi.mock('@/lib/firebase/client', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
  doc: vi.fn((...args: unknown[]) => args.slice(1).join('/')),
  writeBatch: vi.fn(() => ({ set: batchSetMock, commit: batchCommitMock })),
}));

import { applyTermMigration, saveTerm } from '@/lib/firestore/terms';

const fall: Term = {
  id: 't-fall',
  label: 'Fall 2026',
  startDate: '2026-08-24',
  endDate: '2026-12-18',
};

beforeEach(() => {
  batchSetMock.mockClear();
  batchCommitMock.mockReset().mockResolvedValue(undefined);
});

describe('saveTerm', () => {
  it('stores the term at users/{uid}/terms/{id} and updates app state first', async () => {
    const dispatch = vi.fn();
    await saveTerm('u1', fall, dispatch);
    expect(dispatch).toHaveBeenCalledWith({ type: 'ADD_TERM', payload: fall });
    expect(batchSetMock).toHaveBeenCalledWith('users/u1/terms/t-fall', fall);
    expect(batchCommitMock).toHaveBeenCalledTimes(1);
  });

  it('uses UPDATE_TERM for a stored term and puts the old one back if the write fails', async () => {
    const dispatch = vi.fn();
    const edited = { ...fall, endDate: '2026-12-11' };
    batchCommitMock.mockRejectedValueOnce(new Error('offline'));
    await expect(saveTerm('u1', edited, dispatch, fall)).rejects.toThrow('offline');
    expect(dispatch).toHaveBeenNthCalledWith(1, { type: 'UPDATE_TERM', payload: edited });
    expect(dispatch).toHaveBeenNthCalledWith(2, { type: 'UPDATE_TERM', payload: fall });
  });

  it('refuses a term with no usable dates without touching state or Firestore', async () => {
    const dispatch = vi.fn();
    await expect(saveTerm('u1', { ...fall, startDate: '', endDate: '' }, dispatch)).rejects.toThrow(
      /valid first and last day/,
    );
    expect(dispatch).not.toHaveBeenCalled();
    expect(batchCommitMock).not.toHaveBeenCalled();
  });
});

describe('applyTermMigration', () => {
  const course = (id: string, extra: Partial<Course> = {}): Course =>
    ({ id, code: id, title: id, term: 'Fall 2026', credits: 3, ...extra }) as Course;

  it('creates the terms and only adds termId to each course, merging so nothing else is replaced', async () => {
    const dispatch = vi.fn();
    await applyTermMigration(
      'u1',
      { newTerms: [fall], courseLinks: [{ courseId: 'a', termId: 't-fall' }] },
      [course('a')],
      dispatch,
    );
    expect(batchSetMock).toHaveBeenCalledWith('users/u1/terms/t-fall', fall);
    expect(batchSetMock).toHaveBeenCalledWith(
      'users/u1/courses/a',
      { termId: 't-fall' },
      { merge: true },
    );
    // App state sees the link straight away, with the course otherwise unchanged.
    expect(dispatch).toHaveBeenCalledWith({ type: 'ADD_TERM', payload: fall });
    expect(dispatch).toHaveBeenCalledWith({
      type: 'UPDATE_COURSE',
      payload: course('a', { termId: 't-fall' }),
    });
  });

  it('splits a large migration into batches under the Firestore limit', async () => {
    const links = Array.from({ length: 900 }, (_, i) => ({ courseId: `c${i}`, termId: 't-fall' }));
    await applyTermMigration('u1', { newTerms: [fall], courseLinks: links }, [], vi.fn());
    // 901 writes at 400 per batch.
    expect(batchCommitMock).toHaveBeenCalledTimes(3);
  });
});
