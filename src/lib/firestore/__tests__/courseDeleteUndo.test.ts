import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { AppAction } from '@/context/AppStateContext';
import type { Course, ScheduleItem } from '@/types/schedule';

vi.mock('@/lib/firebase/client', () => ({ db: {}, storage: {} }));

const batch = { delete: vi.fn(), commit: vi.fn(() => Promise.resolve()) };
vi.mock('firebase/firestore', () => ({
  doc: vi.fn(() => ({})),
  setDoc: vi.fn(() => Promise.resolve()),
  collection: vi.fn(() => ({})),
  getDocs: vi.fn(() => Promise.resolve({ docs: [] })),
  query: vi.fn(() => ({})),
  where: vi.fn(() => ({})),
  writeBatch: vi.fn(() => batch),
}));
vi.mock('firebase/storage', () => ({ deleteObject: vi.fn(), ref: vi.fn() }));

const course: Course = { id: 'course-1', code: 'CS 301', title: 'Data Structures' };
const task = { id: 't1', courseId: 'course-1', title: 'PS1' } as ScheduleItem;

describe('deleteCourseWithUndo', () => {
  beforeEach(async () => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    const { resetPendingCourseWrites } = await import('../courses');
    resetPendingCourseWrites();
  });
  afterEach(() => vi.useRealTimers());

  it('hides the course at once but deletes nothing until the undo window closes', async () => {
    const { deleteCourseWithUndo, hasPendingCourseWrites, COURSE_DELETE_UNDO_MS } =
      await import('../courses');
    const dispatch = vi.fn() as unknown as React.Dispatch<AppAction>;
    deleteCourseWithUndo('u1', course, [task], dispatch, [], vi.fn());

    expect(dispatch).toHaveBeenCalledWith({ type: 'REMOVE_COURSE', payload: 'course-1' });
    expect(hasPendingCourseWrites('course-1')).toBe(true);
    await vi.advanceTimersByTimeAsync(COURSE_DELETE_UNDO_MS - 1);
    expect(batch.commit).not.toHaveBeenCalled();
  });

  it('puts the course and its tasks back on undo, and never deletes', async () => {
    const { deleteCourseWithUndo, hasPendingCourseWrites, COURSE_DELETE_UNDO_MS } =
      await import('../courses');
    const dispatch = vi.fn() as unknown as React.Dispatch<AppAction>;
    const onFinished = vi.fn();
    const pending = deleteCourseWithUndo('u1', course, [task], dispatch, [], onFinished);

    pending.undo();
    expect(dispatch).toHaveBeenCalledWith({ type: 'ADD_COURSE', payload: course });
    expect(dispatch).toHaveBeenCalledWith({ type: 'ADD_SCHEDULE_ITEM', payload: task });
    expect(hasPendingCourseWrites('course-1')).toBe(false);

    await vi.advanceTimersByTimeAsync(COURSE_DELETE_UNDO_MS * 2);
    expect(batch.commit).not.toHaveBeenCalled();
    expect(onFinished).not.toHaveBeenCalled();
  });

  it('runs the real delete once the window closes and reports the outcome', async () => {
    const { deleteCourseWithUndo, COURSE_DELETE_UNDO_MS } = await import('../courses');
    const dispatch = vi.fn() as unknown as React.Dispatch<AppAction>;
    const onFinished = vi.fn();
    deleteCourseWithUndo('u1', course, [task], dispatch, [], onFinished);

    await vi.advanceTimersByTimeAsync(COURSE_DELETE_UNDO_MS + 10);
    expect(batch.commit).toHaveBeenCalled();
    expect(onFinished).toHaveBeenCalledWith({ result: { failedFiles: 0 } });
  });
});
