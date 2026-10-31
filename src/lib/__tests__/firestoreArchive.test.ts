import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { Course } from '@/types/schedule';

const setDocMock = vi.fn();
vi.mock('@/lib/firebase/client', () => ({ db: {}, storage: {} }));
vi.mock('firebase/firestore', () => ({
  doc: vi.fn((...args: unknown[]) => args.slice(1).join('/')),
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  getDocs: vi.fn(),
  setDoc: (...args: unknown[]) => setDocMock(...args),
  deleteField: () => '<deleteField>',
  writeBatch: vi.fn(),
}));
vi.mock('firebase/storage', () => ({ ref: vi.fn(), deleteObject: vi.fn() }));

import { archiveCourse, restoreCourse, resetPendingCourseWrites } from '@/lib/firestore/courses';

const course: Course = { id: 'c1', code: 'CS 101', title: 'Intro', credits: 4, term: 'Fall 2026' };
const NOW = new Date('2026-10-31T15:00:00.000Z');

beforeEach(() => {
  setDocMock.mockReset().mockResolvedValue(undefined);
  resetPendingCourseWrites();
});

describe('archiveCourse', () => {
  it('marks the course archived in app state first, then writes only archivedAt', async () => {
    const dispatch = vi.fn();
    await archiveCourse('u1', course, dispatch, NOW);
    expect(dispatch).toHaveBeenCalledWith({
      type: 'UPDATE_COURSE',
      payload: { ...course, archivedAt: '2026-10-31T15:00:00.000Z' },
    });
    // A field merge: nothing else on the course document is replaced.
    expect(setDocMock).toHaveBeenCalledWith(
      'users/u1/courses/c1',
      { archivedAt: '2026-10-31T15:00:00.000Z' },
      { merge: true },
    );
  });

  it('puts the course back in use if the write fails', async () => {
    const dispatch = vi.fn();
    setDocMock.mockRejectedValueOnce(new Error('offline'));
    await expect(archiveCourse('u1', course, dispatch, NOW)).rejects.toThrow('offline');
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'UPDATE_COURSE', payload: course });
  });
});

describe('restoreCourse', () => {
  const archived: Course = { ...course, archivedAt: '2026-10-31T15:00:00.000Z' };

  it('brings the course back in app state and removes archivedAt from the document', async () => {
    const dispatch = vi.fn();
    await restoreCourse('u1', archived, dispatch);
    expect(dispatch).toHaveBeenCalledWith({ type: 'UPDATE_COURSE', payload: course });
    expect(dispatch.mock.calls[0][0].payload).not.toHaveProperty('archivedAt');
    expect(setDocMock).toHaveBeenCalledWith(
      'users/u1/courses/c1',
      { archivedAt: '<deleteField>' },
      { merge: true },
    );
  });

  it('archives it again if the write fails', async () => {
    const dispatch = vi.fn();
    setDocMock.mockRejectedValueOnce(new Error('offline'));
    await expect(restoreCourse('u1', archived, dispatch)).rejects.toThrow('offline');
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'UPDATE_COURSE', payload: archived });
  });
});
