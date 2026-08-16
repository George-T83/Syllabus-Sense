import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { Course, ScheduleItem } from '@/types/schedule';

const setDocMock = vi.fn();
const batchDeleteMock = vi.fn();
const batchCommitMock = vi.fn();

vi.mock('@/lib/firebase/client', () => ({ db: {} }));

vi.mock('firebase/firestore', () => ({
  doc: vi.fn((...args: unknown[]) => args.join('/')),
  setDoc: (...args: unknown[]) => setDocMock(...args),
  writeBatch: vi.fn(() => ({
    delete: batchDeleteMock,
    commit: batchCommitMock,
  })),
}));

import { createCourse, updateCourse, deleteCourse } from '@/lib/firestore/courses';

const course: Course = { id: 'c1', code: 'CS 101', title: 'Intro' };
const otherCourse: Course = { id: 'c2', code: 'MA 101', title: 'Calc' };
const relatedItem: ScheduleItem = {
  id: 'i1',
  courseId: 'c1',
  title: 'HW1',
  type: 'assignment',
  dueDate: '2026-09-01T00:00:00.000Z',
  completed: false,
};

describe('Firestore courses service', () => {
  beforeEach(() => {
    setDocMock.mockReset().mockResolvedValue(undefined);
    batchDeleteMock.mockReset();
    batchCommitMock.mockReset().mockResolvedValue(undefined);
  });

  it('createCourse dispatches optimistically then writes to Firestore', async () => {
    const dispatch = vi.fn();
    await createCourse('u1', course, dispatch);

    expect(dispatch).toHaveBeenCalledWith({ type: 'ADD_COURSE', payload: course });
    expect(setDocMock).toHaveBeenCalledTimes(1);
  });

  it('createCourse rolls back the optimistic dispatch on write failure', async () => {
    setDocMock.mockRejectedValueOnce(new Error('network down'));
    const dispatch = vi.fn();

    await expect(createCourse('u1', course, dispatch)).rejects.toThrow('network down');

    expect(dispatch).toHaveBeenNthCalledWith(1, { type: 'ADD_COURSE', payload: course });
    expect(dispatch).toHaveBeenNthCalledWith(2, { type: 'REMOVE_COURSE', payload: course.id });
  });

  it('updateCourse rolls back to the previous course on failure', async () => {
    setDocMock.mockRejectedValueOnce(new Error('offline'));
    const dispatch = vi.fn();
    const updated: Course = { ...course, title: 'Intro to CS' };

    await expect(updateCourse('u1', course, updated, dispatch)).rejects.toThrow('offline');

    expect(dispatch).toHaveBeenNthCalledWith(1, { type: 'UPDATE_COURSE', payload: updated });
    expect(dispatch).toHaveBeenNthCalledWith(2, { type: 'UPDATE_COURSE', payload: course });
  });

  it('deleteCourse batch-deletes the course and all related schedule items', async () => {
    const dispatch = vi.fn();
    await deleteCourse('u1', course, [relatedItem], dispatch);

    expect(dispatch).toHaveBeenCalledWith({ type: 'REMOVE_COURSE', payload: course.id });
    expect(batchDeleteMock).toHaveBeenCalledTimes(2); // course + 1 related item
    expect(batchCommitMock).toHaveBeenCalledTimes(1);
  });

  it('deleteCourse rolls back by re-adding the course and its items on failure', async () => {
    batchCommitMock.mockRejectedValueOnce(new Error('denied'));
    const dispatch = vi.fn();

    await expect(deleteCourse('u1', course, [relatedItem], dispatch)).rejects.toThrow('denied');

    expect(dispatch).toHaveBeenCalledWith({ type: 'ADD_COURSE', payload: course });
    expect(dispatch).toHaveBeenCalledWith({ type: 'ADD_SCHEDULE_ITEM', payload: relatedItem });
  });

  it('deleteCourse never touches an unrelated course', async () => {
    const dispatch = vi.fn();
    await deleteCourse('u1', course, [relatedItem], dispatch);

    expect(dispatch).not.toHaveBeenCalledWith({ type: 'REMOVE_COURSE', payload: otherCourse.id });
  });
});
