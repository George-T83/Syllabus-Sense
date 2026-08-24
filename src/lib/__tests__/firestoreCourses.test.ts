import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { Contact, Course, ScheduleItem } from '@/types/schedule';

const setDocMock = vi.fn();
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
  getDocs: (...args: unknown[]) => getDocsMock(...args),
  setDoc: (...args: unknown[]) => setDocMock(...args),
  deleteDoc: (...args: unknown[]) => deleteDocMock(...args),
  writeBatch: vi.fn(() => ({
    delete: batchDeleteMock,
    commit: batchCommitMock,
  })),
}));

vi.mock('firebase/storage', () => ({
  ref: vi.fn((_storage: unknown, path: string) => ({ path })),
  deleteObject: (...args: unknown[]) => deleteObjectMock(...args),
}));

import { createCourse, updateCourse, deleteCourse } from '@/lib/firestore/courses';
import { deleteAllCourseSyllabi, deleteSyllabusUpload } from '@/lib/firestore/syllabi';
import type { SyllabusUpload } from '@/types/syllabus';

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
const relatedContact: Contact = {
  id: 'ct1',
  courseId: 'c1',
  role: 'professor',
  fullName: 'Dr. Jane Smith',
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
    batchDeleteMock.mockReset();
    batchCommitMock.mockReset().mockResolvedValue(undefined);
    getDocsMock.mockReset().mockResolvedValue({ docs: [] });
    deleteObjectMock.mockReset().mockResolvedValue(undefined);
    deleteDocMock.mockReset().mockResolvedValue(undefined);
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
