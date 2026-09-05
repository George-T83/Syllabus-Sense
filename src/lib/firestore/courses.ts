import { collection, doc, getDocs, query, setDoc, where, writeBatch } from 'firebase/firestore';
import { deleteObject, ref } from 'firebase/storage';
import { db, storage } from '@/lib/firebase/client';
import type { AppAction } from '@/context/AppStateContext';
import type { Contact, Course, ScheduleItem } from '@/types/schedule';
import type { SyllabusUpload } from '@/types/syllabus';

function requireDb() {
  if (!db) throw new Error('Firestore is not configured.');
  return db;
}

interface PendingCourseWriteEntry {
  promise: Promise<unknown>;
  latestCourse?: Course;
  pendingCount: number;
}

/**
 * Per-course write queue, keyed by course id - same reasoning and shape as
 * scheduleItems.ts's enqueueWrite. Materials, learning objectives, and
 * absences all live as arrays on the one course document (not their own
 * subcollection documents), so two overlapping edits - e.g. adding a
 * material right after adding an objective - each carry the FULL course
 * object, not a partial patch. Without ordering, whichever setDoc resolves
 * last on the wire wins regardless of which edit was requested last,
 * silently dropping the earlier one. Chaining writes for the same course id
 * forces them to land in request order instead of racing.
 */
const pendingCourseWrites = new Map<string, PendingCourseWriteEntry>();
const pendingCourseDeletions = new Set<string>();

export function hasPendingCourseWrites(courseId: string): boolean {
  return (
    (pendingCourseWrites.get(courseId)?.pendingCount ?? 0) > 0 ||
    pendingCourseDeletions.has(courseId)
  );
}

export function isPendingCourseDeletion(courseId: string): boolean {
  return pendingCourseDeletions.has(courseId);
}

export function getLatestPendingCourse(courseId: string): Course | undefined {
  return pendingCourseWrites.get(courseId)?.latestCourse;
}

/** Resets in-memory write queues (used for test isolation). */
export function resetPendingCourseWrites(): void {
  pendingCourseWrites.clear();
  pendingCourseDeletions.clear();
}

function enqueueCourseWrite(
  courseId: string,
  course: Course,
  write: () => Promise<unknown>,
): Promise<unknown> {
  const existing = pendingCourseWrites.get(courseId);
  const previous = existing?.promise ?? Promise.resolve();
  const currentCount = (existing?.pendingCount ?? 0) + 1;

  const run = previous.catch(() => {}).then(write);

  const entry: PendingCourseWriteEntry = {
    promise: run,
    latestCourse: course,
    pendingCount: currentCount,
  };
  pendingCourseWrites.set(courseId, entry);

  run
    .finally(() => {
      const current = pendingCourseWrites.get(courseId);
      if (current) {
        current.pendingCount -= 1;
        if (current.pendingCount <= 0 || current.promise === run) {
          pendingCourseWrites.delete(courseId);
        }
      }
    })
    .catch(() => {});

  return run;
}

/**
 * Reconciles an incoming remote Firestore snapshot of courses with active
 * local state, the same way reconcileScheduleItems does: a course with an
 * in-flight write or deletion keeps its local optimistic state instead of
 * flickering to whatever the snapshot happened to catch mid-write.
 */
export function reconcileCourses(remoteCourses: Course[], localCourses: Course[] = []): Course[] {
  const remoteMap = new Map(remoteCourses.map((c) => [c.id, c]));
  const localMap = new Map(localCourses.map((c) => [c.id, c]));
  const reconciled: Course[] = [];

  for (const remoteCourse of remoteCourses) {
    if (pendingCourseDeletions.has(remoteCourse.id)) continue;

    if (hasPendingCourseWrites(remoteCourse.id)) {
      const localCourse =
        localMap.get(remoteCourse.id) ?? getLatestPendingCourse(remoteCourse.id) ?? remoteCourse;
      reconciled.push(localCourse);
    } else {
      reconciled.push(remoteCourse);
    }
  }

  for (const localCourse of localCourses) {
    if (
      !remoteMap.has(localCourse.id) &&
      hasPendingCourseWrites(localCourse.id) &&
      !pendingCourseDeletions.has(localCourse.id)
    ) {
      reconciled.push(localCourse);
    }
  }

  return reconciled;
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
    await enqueueCourseWrite(course.id, course, () =>
      setDoc(doc(requireDb(), 'users', userId, 'courses', course.id), course),
    );
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

/**
 * Updates a course and cascades term/semester changes to all associated contacts
 * so directory filtering stays consistent.
 */
export async function updateCourse(
  userId: string,
  previousCourse: Course,
  updatedCourse: Course,
  dispatch: React.Dispatch<AppAction>,
  relatedContacts?: Contact[],
): Promise<void> {
  dispatch({ type: 'UPDATE_COURSE', payload: updatedCourse });

  const termChanged = previousCourse.term !== updatedCourse.term;
  let affectedContacts: Contact[] = [];
  let updatedContacts: Contact[] = [];

  if (termChanged) {
    const database = requireDb();
    if (relatedContacts) {
      affectedContacts = relatedContacts.filter((c) => c.courseId === updatedCourse.id);
    } else {
      const snap = await getDocs(
        query(
          collection(database, 'users', userId, 'contacts'),
          where('courseId', '==', updatedCourse.id),
        ),
      );
      affectedContacts = snap.docs.map((d) => d.data() as Contact);
    }

    updatedContacts = affectedContacts.map((c) => {
      const updated = { ...c };
      if (updatedCourse.term) {
        updated.term = updatedCourse.term;
      } else {
        delete updated.term;
      }
      return updated;
    });

    updatedContacts.forEach((c) => dispatch({ type: 'UPDATE_CONTACT', payload: c }));
  }

  try {
    const database = requireDb();
    await enqueueCourseWrite(updatedCourse.id, updatedCourse, async () => {
      if (termChanged && updatedContacts.length > 0) {
        const batch = writeBatch(database);
        batch.set(doc(database, 'users', userId, 'courses', updatedCourse.id), updatedCourse);
        updatedContacts.forEach((c) => {
          batch.set(doc(database, 'users', userId, 'contacts', c.id), c);
        });
        await batch.commit();
      } else {
        await setDoc(doc(database, 'users', userId, 'courses', updatedCourse.id), updatedCourse);
      }
    });
  } catch (err) {
    dispatch({ type: 'UPDATE_COURSE', payload: previousCourse });
    if (termChanged && affectedContacts.length > 0) {
      affectedContacts.forEach((c) => dispatch({ type: 'UPDATE_CONTACT', payload: c }));
    }
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
  pendingCourseDeletions.add(course.id);
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
  } finally {
    pendingCourseDeletions.delete(course.id);
  }
}
