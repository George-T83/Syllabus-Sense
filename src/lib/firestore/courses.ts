import { collection, doc, getDocs, setDoc, writeBatch } from 'firebase/firestore';
import { deleteObject, ref } from 'firebase/storage';
import { db, storage } from '@/lib/firebase/client';
import type { AppAction } from '@/context/AppStateContext';
import type { Contact, Course, ScheduleItem } from '@/types/schedule';
import type { SyllabusUpload } from '@/types/syllabus';

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

/**
 * Creates a course together with a batch of schedule items in a single
 * atomic Firestore write - used by the syllabus autofiller, where a course
 * with 20+ extracted assignments should never partially land (e.g. the
 * course saved but half the assignments missing because of a mid-loop
 * network failure).
 */
export async function createCourseWithScheduleItems(
  userId: string,
  course: Course,
  scheduleItems: ScheduleItem[],
  dispatch: React.Dispatch<AppAction>,
): Promise<void> {
  dispatch({ type: 'ADD_COURSE', payload: course });
  scheduleItems.forEach((item) => dispatch({ type: 'ADD_SCHEDULE_ITEM', payload: item }));
  try {
    const database = requireDb();
    const batch = writeBatch(database);
    batch.set(doc(database, 'users', userId, 'courses', course.id), course);
    scheduleItems.forEach((item) => {
      batch.set(doc(database, 'users', userId, 'scheduleItems', item.id), item);
    });
    await batch.commit();
  } catch (err) {
    dispatch({ type: 'REMOVE_COURSE', payload: course.id });
    scheduleItems.forEach((item) => dispatch({ type: 'REMOVE_SCHEDULE_ITEM', payload: item.id }));
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
 * Deletes a course, every schedule item, every contact, and every syllabus upload
 * that belongs to it in a single Firestore batch and cleans up Firebase Storage files,
 * matching the cascading behavior already baked into the local REMOVE_COURSE reducer case.
 */
export async function deleteCourse(
  userId: string,
  course: Course,
  relatedItems: ScheduleItem[],
  dispatch: React.Dispatch<AppAction>,
  relatedContacts: Contact[] = [],
): Promise<void> {
  dispatch({ type: 'REMOVE_COURSE', payload: course.id });
  try {
    const database = requireDb();
    const batch = writeBatch(database);
    batch.delete(doc(database, 'users', userId, 'courses', course.id));
    relatedItems.forEach((item) => {
      batch.delete(doc(database, 'users', userId, 'scheduleItems', item.id));
    });
    relatedContacts.forEach((contact) => {
      batch.delete(doc(database, 'users', userId, 'contacts', contact.id));
    });

    // Query and cascade delete all syllabus upload records in the subcollection
    const syllabiSnap = await getDocs(
      collection(database, 'users', userId, 'courses', course.id, 'syllabi'),
    );
    const storagePromises: Promise<void>[] = [];
    syllabiSnap.docs.forEach((syllabusDoc) => {
      batch.delete(syllabusDoc.ref);
      const data = syllabusDoc.data() as Partial<SyllabusUpload>;
      if (storage && data?.storagePath) {
        storagePromises.push(deleteObject(ref(storage, data.storagePath)).catch(() => {}));
      }
    });

    await batch.commit();
    await Promise.all(storagePromises);
  } catch (err) {
    dispatch({ type: 'ADD_COURSE', payload: course });
    relatedItems.forEach((item) => dispatch({ type: 'ADD_SCHEDULE_ITEM', payload: item }));
    if (relatedContacts.length > 0) {
      dispatch({ type: 'ADD_CONTACTS', payload: relatedContacts });
    }
    throw err;
  }
}
