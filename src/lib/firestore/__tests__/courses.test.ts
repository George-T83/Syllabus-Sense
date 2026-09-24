import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AppAction } from '@/context/AppStateContext';
import type { Course } from '@/types/schedule';

vi.mock('@/lib/firebase/client', () => ({ db: {}, storage: {} }));

let pendingSetDocResolvers: Array<() => void> = [];
vi.mock('firebase/firestore', () => ({
  doc: vi.fn(() => ({})),
  setDoc: vi.fn(
    () =>
      new Promise<void>((resolve) => {
        pendingSetDocResolvers.push(resolve);
      }),
  ),
  collection: vi.fn(() => ({})),
  getDocs: vi.fn(() => Promise.resolve({ docs: [] })),
  query: vi.fn(() => ({})),
  where: vi.fn(() => ({})),
  writeBatch: vi.fn(),
}));

vi.mock('firebase/storage', () => ({
  deleteObject: vi.fn(),
  ref: vi.fn(),
}));

const baseCourse: Course = { id: 'course-1', code: 'CS 301', title: 'Data Structures' };

describe('reconcileCourses', () => {
  beforeEach(async () => {
    const { resetPendingCourseWrites } = await import('../courses');
    resetPendingCourseWrites();
    pendingSetDocResolvers = [];
  });

  it('prefers a course with no write in flight straight from the remote snapshot', async () => {
    const { reconcileCourses } = await import('../courses');
    const remote = { ...baseCourse };
    const result = reconcileCourses([remote], [baseCourse]);
    expect(result).toEqual([remote]);
  });

  it(
    "prefers the write queue's own latest course over a stale local snapshot while a write " +
      'is in flight - regression for Section Sync creating a group and having groupCode wiped ' +
      'back out by a same-write onSnapshot echo racing ahead of the stateRef update',
    async () => {
      const { reconcileCourses, updateCourse, hasPendingCourseWrites, getLatestPendingCourse } =
        await import('../courses');
      const dispatch = vi.fn() as unknown as React.Dispatch<AppAction>;
      const updatedCourse: Course = { ...baseCourse, groupCode: 'AB3DEFGH' };

      // Fire the write but don't resolve it yet - the queue entry is
      // populated synchronously, before any network round trip completes.
      const writeDone = updateCourse('user-1', baseCourse, updatedCourse, dispatch);

      expect(hasPendingCourseWrites('course-1')).toBe(true);
      expect(getLatestPendingCourse('course-1')).toEqual(updatedCourse);

      // Simulate the race: an onSnapshot listener's `stateRef.current.courses`
      // hasn't caught up to the optimistic dispatch yet, so its local
      // snapshot is still the pre-write course.
      const staleLocalCourses = [baseCourse];
      const remoteCourses = [baseCourse]; // server hasn't acked the write yet either

      const reconciled = reconcileCourses(remoteCourses, staleLocalCourses);
      expect(reconciled).toEqual([updatedCourse]);

      // Let the write queue's microtask chain actually reach the mocked
      // setDoc call before resolving it, then let the write settle.
      while (pendingSetDocResolvers.length === 0) {
        await Promise.resolve();
      }
      pendingSetDocResolvers.forEach((resolve) => resolve());
      await writeDone;
    },
  );
});
