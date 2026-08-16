import { doc, setDoc, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import type { AppAction } from '@/context/AppStateContext';
import type { Course, ScheduleItem } from '@/types/schedule';

function requireDb() {
  if (!db) throw new Error('Firestore is not configured.');
  return db;
}

/**
 * Dispatches the optimistic update immediately so the UI feels instant, then
 * writes to Firestore. On failure, dispatches the inverse action to roll the
 * optimistic change back so local state never drifts from what's persisted.
 */
export async function createCourse(
  userId: string,
  course: Course,
  dispatch: React.Dispatch<AppAction>,
): Promise<void> {
  dispatch({ type: 'ADD_COURSE', payload: course });
  try {
    await setDoc(doc(requireDb(), 'users', userId, 'courses', course.id), course);
  } catch (err) {
    dispatch({ type: 'REMOVE_COURSE', payload: course.id });
    throw err;
  }
}

export async function updateCourse(
  userId: string,
  previousCourse: Course,
  updatedCourse: Course,
  dispatch: React.Dispatch<AppAction>,
): Promise<void> {
  dispatch({ type: 'UPDATE_COURSE', payload: updatedCourse });
  try {
    await setDoc(doc(requireDb(), 'users', userId, 'courses', updatedCourse.id), updatedCourse);
  } catch (err) {
    dispatch({ type: 'UPDATE_COURSE', payload: previousCourse });
    throw err;
  }
}

/**
 * Deletes a course and every schedule item that belongs to it in a single
 * Firestore batch, matching the cascading behavior already baked into the
 * local REMOVE_COURSE reducer case.
 */
export async function deleteCourse(
  userId: string,
  course: Course,
  relatedItems: ScheduleItem[],
  dispatch: React.Dispatch<AppAction>,
): Promise<void> {
  dispatch({ type: 'REMOVE_COURSE', payload: course.id });
  try {
    const database = requireDb();
    const batch = writeBatch(database);
    batch.delete(doc(database, 'users', userId, 'courses', course.id));
    relatedItems.forEach((item) => {
      batch.delete(doc(database, 'users', userId, 'scheduleItems', item.id));
    });
    await batch.commit();
  } catch (err) {
    dispatch({ type: 'ADD_COURSE', payload: course });
    relatedItems.forEach((item) => dispatch({ type: 'ADD_SCHEDULE_ITEM', payload: item }));
    throw err;
  }
}
