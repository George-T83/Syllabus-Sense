import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { Contact, Course, ScheduleItem } from '@/types/schedule';

const setDocMock = vi.fn();
const batchSetMock = vi.fn();
const batchDeleteMock = vi.fn();
const batchCommitMock = vi.fn();
const getDocsMock = vi.fn();
const deleteObjectMock = vi.fn();
const deleteDocMock = vi.fn();

vi.mock('@/lib/firebase/client', () => ({
  db: {},
  storage: {},
}));

vi.mock('firebase/firestore', () => ({
  doc: vi.fn((...args: unknown[]) => args.join('/')),
  collection: vi.fn((...args: unknown[]) => args.join('/')),
  query: vi.fn((...args: unknown[]) => args),
  where: vi.fn((...args: unknown[]) => args),
  getDocs: (...args: unknown[]) => getDocsMock(...args),
  setDoc: (...args: unknown[]) => setDocMock(...args),
  deleteDoc: (...args: unknown[]) => deleteDocMock(...args),
  writeBatch: vi.fn(() => ({
    set: batchSetMock,
    delete: batchDeleteMock,
    commit: batchCommitMock,
  })),
}));

vi.mock('firebase/storage', () => ({
  ref: vi.fn((_storage: unknown, path: string) => ({ path })),
  deleteObject: (...args: unknown[]) => deleteObjectMock(...args),
}));

import {
  createCourse,
  updateCourse,
  deleteCourse,
  reconcileCourses,
  hasPendingCourseWrites,
  isPendingCourseDeletion,
  resetPendingCourseWrites,
} from '@/lib/firestore/courses';
import { deleteAllCourseSyllabi, deleteSyllabusUpload } from '@/lib/firestore/syllabi';
import type { SyllabusUpload } from '@/types/syllabus';

const course: Course = { id: 'c1', code: 'CS 101', title: 'Intro', term: 'Fall 2026' };
const otherCourse: Course = { id: 'c2', code: 'MA 101', title: 'Calc', term: 'Fall 2026' };
const relatedItem: ScheduleItem = {
  id: 'i1',
  courseId: 'c1',
  title: 'HW1',
  type: 'assignment',
  dueDate: '2026-09-01T00:00:00.000Z',
  completed: false,
};
const relatedContact: Contact = {
  id: 'ct1',
  courseId: 'c1',
  role: 'professor',
  fullName: 'Dr. Jane Smith',
  term: 'Fall 2026',
  source: 'manual',
  approved: true,
};
const mockSyllabus: SyllabusUpload = {
  id: 's1',
  courseId: 'c1',
  fileName: 'syllabus.pdf',
  storagePath: 'users/u1/syllabi/c1/s1-syllabus.pdf',
  downloadURL: 'https://storage.googleapis.com/...',
  sizeBytes: 1024,
  uploadedAt: '2026-08-24T00:00:00.000Z',
};

describe('Firestore courses service', () => {
  beforeEach(() => {
    setDocMock.mockReset().mockResolvedValue(undefined);
    batchSetMock.mockReset();
    batchDeleteMock.mockReset();
    batchCommitMock.mockReset().mockResolvedValue(undefined);
    getDocsMock.mockReset().mockResolvedValue({ docs: [] });
    deleteObjectMock.mockReset().mockResolvedValue(undefined);
    deleteDocMock.mockReset().mockResolvedValue(undefined);
    resetPendingCourseWrites();
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

  it('updateCourse writes via setDoc when term is unchanged', async () => {
    const dispatch = vi.fn();
    const updated: Course = { ...course, title: 'Intro to CS' };

    await updateCourse('u1', course, updated, dispatch, [relatedContact]);

    expect(dispatch).toHaveBeenCalledWith({ type: 'UPDATE_COURSE', payload: updated });
    expect(setDocMock).toHaveBeenCalledTimes(1);
    expect(batchCommitMock).not.toHaveBeenCalled();
  });

  it('updateCourse cascades term changes to related contacts via writeBatch and dispatches updates', async () => {
    const dispatch = vi.fn();
    const updated: Course = { ...course, term: 'Spring 2027' };

    await updateCourse('u1', course, updated, dispatch, [relatedContact]);

    expect(dispatch).toHaveBeenCalledWith({ type: 'UPDATE_COURSE', payload: updated });
    expect(dispatch).toHaveBeenCalledWith({
      type: 'UPDATE_CONTACT',
      payload: expect.objectContaining({ id: 'ct1', term: 'Spring 2027' }),
    });
    expect(batchSetMock).toHaveBeenCalledTimes(2); // 1 course + 1 contact
    expect(batchCommitMock).toHaveBeenCalledTimes(1);
  });

  it('updateCourse cascades term changes querying contacts if relatedContacts is not provided', async () => {
    const dispatch = vi.fn();
    const updated: Course = { ...course, term: 'Spring 2027' };
    getDocsMock.mockResolvedValueOnce({
      docs: [
        {
          data: () => relatedContact,
        },
      ],
    });

    await updateCourse('u1', course, updated, dispatch);

    expect(dispatch).toHaveBeenCalledWith({
      type: 'UPDATE_CONTACT',
      payload: expect.objectContaining({ id: 'ct1', term: 'Spring 2027' }),
    });
    expect(batchSetMock).toHaveBeenCalledTimes(2);
    expect(batchCommitMock).toHaveBeenCalledTimes(1);
  });

  it('updateCourse rolls back course and contacts on failure', async () => {
    batchCommitMock.mockRejectedValueOnce(new Error('offline'));
    const dispatch = vi.fn();
    const updated: Course = { ...course, term: 'Spring 2027' };

    await expect(updateCourse('u1', course, updated, dispatch, [relatedContact])).rejects.toThrow(
      'offline',
    );

    expect(dispatch).toHaveBeenCalledWith({ type: 'UPDATE_COURSE', payload: updated });
    expect(dispatch).toHaveBeenCalledWith({ type: 'UPDATE_COURSE', payload: course });
    expect(dispatch).toHaveBeenCalledWith({ type: 'UPDATE_CONTACT', payload: relatedContact });
  });

  it('deleteCourse batch-deletes the course, related schedule items, and related contacts', async () => {
    const dispatch = vi.fn();
    await deleteCourse('u1', course, [relatedItem], dispatch, [relatedContact]);

    expect(dispatch).toHaveBeenCalledWith({ type: 'REMOVE_COURSE', payload: course.id });
    expect(batchDeleteMock).toHaveBeenCalledTimes(3); // course + 1 item + 1 contact
    expect(batchCommitMock).toHaveBeenCalledTimes(1);
  });

  it('deleteCourse cascades to delete syllabus upload documents and storage files', async () => {
    const dispatch = vi.fn();
    getDocsMock.mockResolvedValueOnce({
      docs: [
        {
          id: 's1',
          ref: 'users/u1/courses/c1/syllabi/s1',
          data: () => mockSyllabus,
        },
      ],
    });

    await deleteCourse('u1', course, [relatedItem], dispatch, [relatedContact]);

    expect(dispatch).toHaveBeenCalledWith({ type: 'REMOVE_COURSE', payload: course.id });
    expect(batchDeleteMock).toHaveBeenCalledTimes(4); // course + 1 item + 1 contact + 1 syllabus
    expect(deleteObjectMock).toHaveBeenCalledWith(
      expect.objectContaining({ path: mockSyllabus.storagePath }),
    );
    expect(batchCommitMock).toHaveBeenCalledTimes(1);
  });

  it('deleteCourse tolerates storage deletion errors when file is already removed', async () => {
    const dispatch = vi.fn();
    deleteObjectMock.mockRejectedValueOnce(new Error('storage/object-not-found'));
    getDocsMock.mockResolvedValueOnce({
      docs: [
        {
          id: 's1',
          ref: 'users/u1/courses/c1/syllabi/s1',
          data: () => mockSyllabus,
        },
      ],
    });

    await expect(
      deleteCourse('u1', course, [relatedItem], dispatch, [relatedContact]),
    ).resolves.not.toThrow();

    expect(batchCommitMock).toHaveBeenCalledTimes(1);
  });

  it('deleteCourse rolls back by re-adding the course, items, and contacts on failure', async () => {
    batchCommitMock.mockRejectedValueOnce(new Error('denied'));
    const dispatch = vi.fn();

    await expect(
      deleteCourse('u1', course, [relatedItem], dispatch, [relatedContact]),
    ).rejects.toThrow('denied');

    expect(dispatch).toHaveBeenCalledWith({ type: 'ADD_COURSE', payload: course });
    expect(dispatch).toHaveBeenCalledWith({ type: 'ADD_SCHEDULE_ITEM', payload: relatedItem });
    expect(dispatch).toHaveBeenCalledWith({ type: 'ADD_CONTACTS', payload: [relatedContact] });
  });

  it('deleteCourse never touches an unrelated course', async () => {
    const dispatch = vi.fn();
    await deleteCourse('u1', course, [relatedItem], dispatch);

    expect(dispatch).not.toHaveBeenCalledWith({ type: 'REMOVE_COURSE', payload: otherCourse.id });
  });

  it('serializes overlapping updates to the same course instead of racing', async () => {
    let resolveFirstWrite: () => void = () => {};
    const firstWrite = new Promise<void>((resolve) => {
      resolveFirstWrite = resolve;
    });
    setDocMock.mockImplementationOnce(() => firstWrite);
    setDocMock.mockImplementationOnce(() => Promise.resolve());

    const dispatch = vi.fn();
    const renamedOnce: Course = { ...course, title: 'Intro to CS' };
    const renamedTwice: Course = { ...renamedOnce, title: 'Intro to Computer Science' };

    const firstUpdate = updateCourse('u1', course, renamedOnce, dispatch);
    const secondUpdate = updateCourse('u1', renamedOnce, renamedTwice, dispatch);

    expect(hasPendingCourseWrites(course.id)).toBe(true);

    await Promise.resolve();
    await Promise.resolve();
    expect(setDocMock).toHaveBeenCalledTimes(1);

    resolveFirstWrite();
    await firstUpdate;
    await secondUpdate;

    expect(setDocMock).toHaveBeenCalledTimes(2);
    expect(hasPendingCourseWrites(course.id)).toBe(false);
  });

  describe('reconcileCourses (Snapshot Reconciliation)', () => {
    it('returns authoritative remote courses when there are no active in-flight writes', () => {
      const remote = [course, otherCourse];
      const local = [course, otherCourse];
      expect(reconcileCourses(remote, local)).toEqual(remote);
    });

    it('preserves local optimistic state when remote snapshot is stale during an in-flight write', async () => {
      let resolveWrite: () => void = () => {};
      setDocMock.mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            resolveWrite = resolve;
          }),
      );

      const dispatch = vi.fn();
      const renamed: Course = { ...course, title: 'Intro to CS' };
      updateCourse('u1', course, renamed, dispatch);

      expect(hasPendingCourseWrites(course.id)).toBe(true);

      const staleRemoteSnapshot = [course, otherCourse];
      const localState = [renamed, otherCourse];
      const reconciled = reconcileCourses(staleRemoteSnapshot, localState);

      expect(reconciled.find((c) => c.id === course.id)?.title).toBe('Intro to CS');
      expect(reconciled.find((c) => c.id === otherCourse.id)?.title).toBe(otherCourse.title);

      resolveWrite();
      await Promise.resolve();
    });

    it('filters out a course pending deletion even if a stale remote snapshot still contains it', () => {
      let resolveGetDocs: (v: { docs: never[] }) => void = () => {};
      getDocsMock.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveGetDocs = resolve;
          }),
      );

      const dispatch = vi.fn();
      // Deliberately not awaited: deleteCourse's first await is the getDocs
      // call above, which never resolves in this test - this only checks
      // the synchronous pendingCourseDeletions bookkeeping and the
      // reconciliation it drives, the same shape as the analogous
      // scheduleItems "filters out pending deleted items" test.
      void deleteCourse('u1', course, [], dispatch);

      expect(isPendingCourseDeletion(course.id)).toBe(true);

      const staleRemoteSnapshot = [course, otherCourse];
      const localState = [otherCourse];
      const reconciled = reconcileCourses(staleRemoteSnapshot, localState);

      expect(reconciled.map((c) => c.id)).not.toContain(course.id);
      expect(reconciled.map((c) => c.id)).toContain(otherCourse.id);

      resolveGetDocs({ docs: [] });
    });
  });
});

describe('Firestore syllabi service', () => {
  beforeEach(() => {
    deleteObjectMock.mockReset().mockResolvedValue(undefined);
    deleteDocMock.mockReset().mockResolvedValue(undefined);
    getDocsMock.mockReset().mockResolvedValue({ docs: [] });
  });

  it('deleteSyllabusUpload deletes the doc and cleans up storage object', async () => {
    await deleteSyllabusUpload('u1', mockSyllabus);

    expect(deleteDocMock).toHaveBeenCalledTimes(1);
    expect(deleteObjectMock).toHaveBeenCalledWith(
      expect.objectContaining({ path: mockSyllabus.storagePath }),
    );
  });

  it('deleteAllCourseSyllabi queries the subcollection and cleans up all documents and storage files', async () => {
    getDocsMock.mockResolvedValueOnce({
      docs: [
        {
          id: 's1',
          ref: 'users/u1/courses/c1/syllabi/s1',
          data: () => mockSyllabus,
        },
        {
          id: 's2',
          ref: 'users/u1/courses/c1/syllabi/s2',
          data: () => ({ ...mockSyllabus, id: 's2', storagePath: 'users/u1/syllabi/c1/s2.pdf' }),
        },
      ],
    });

    await deleteAllCourseSyllabi('u1', 'c1');

    expect(getDocsMock).toHaveBeenCalledTimes(1);
    expect(deleteDocMock).toHaveBeenCalledTimes(2);
    expect(deleteObjectMock).toHaveBeenCalledTimes(2);
  });
});
