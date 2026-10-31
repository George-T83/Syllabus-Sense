'use client';

import { useCallback, useState } from 'react';
import { useAppState } from '@/context/AppStateContext';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/Toast';
import { archiveCourse, deleteCourse, restoreCourse } from '@/lib/firestore/courses';
import type { CourseContents } from '@/lib/archive/contents';
import type { Contact, Course, ScheduleItem } from '@/types/schedule';

/** What `course` holds among the records the app has loaded (pass the archived
 * part for an archived course). */
export function countContents(
  courseId: string,
  records: {
    scheduleItems: { courseId?: string }[];
    contacts: { courseId?: string }[];
    flashcards: { courseId?: string }[];
    quizzes: { courseId?: string }[];
  },
): CourseContents {
  const mine = (rows: { courseId?: string }[]) =>
    rows.filter((r) => r.courseId === courseId).length;
  return {
    tasks: mine(records.scheduleItems),
    contacts: mine(records.contacts),
    flashcards: mine(records.flashcards),
    quizzes: mine(records.quizzes),
  };
}

export type CourseArchiveAction = 'archive' | 'restore' | 'delete';

/**
 * Archive, restore and delete-forever for a course, with the toasts and busy
 * state every place that offers them shares. Each returns true when it
 * worked. Archiving never deletes anything; deleting forever is the existing
 * cascade in lib/firestore/courses.ts.
 */
export function useCourseArchive() {
  const { user } = useAuth();
  const { dispatch } = useAppState();
  const { showSuccess, showError, showWarning } = useToast();
  const [busy, setBusy] = useState<CourseArchiveAction | null>(null);

  const archive = useCallback(
    async (course: Course): Promise<boolean> => {
      if (!user) return false;
      setBusy('archive');
      try {
        await archiveCourse(user.uid, course, dispatch);
        showSuccess(
          `${course.code} archived`,
          'Everything in it is kept. Restore it any time from Courses, under Archived.',
        );
        return true;
      } catch (err) {
        showError('Could not archive course', err instanceof Error ? err.message : undefined);
        return false;
      } finally {
        setBusy(null);
      }
    },
    [user, dispatch, showSuccess, showError],
  );

  const restore = useCallback(
    async (course: Course): Promise<boolean> => {
      if (!user) return false;
      setBusy('restore');
      try {
        await restoreCourse(user.uid, course, dispatch);
        showSuccess(
          `${course.code} restored`,
          'It is back on your dashboard, calendar and Advisor.',
        );
        return true;
      } catch (err) {
        showError('Could not restore course', err instanceof Error ? err.message : undefined);
        return false;
      } finally {
        setBusy(null);
      }
    },
    [user, dispatch, showSuccess, showError],
  );

  const deleteForever = useCallback(
    async (course: Course, items: ScheduleItem[], contacts: Contact[]): Promise<boolean> => {
      if (!user) return false;
      setBusy('delete');
      try {
        const { failedFiles } = await deleteCourse(user.uid, course, items, dispatch, contacts);
        if (failedFiles > 0) {
          showWarning(
            'Course deleted, but not all files',
            `${failedFiles} uploaded ${failedFiles === 1 ? 'file' : 'files'} for ${course.code} couldn't be removed from storage.`,
          );
        } else {
          showSuccess('Course deleted', `${course.code} and everything in it was removed.`);
        }
        return true;
      } catch (err) {
        showError('Could not delete course', err instanceof Error ? err.message : undefined);
        return false;
      } finally {
        setBusy(null);
      }
    },
    [user, dispatch, showSuccess, showError, showWarning],
  );

  return { archive, restore, deleteForever, busy };
}
