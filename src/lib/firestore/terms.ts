import { doc, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import type { AppAction } from '@/context/AppStateContext';
import type { Course } from '@/types/schedule';
import type { Term } from '@/types/term';
import type { TermMigrationPlan } from '@/lib/terms/termMigration';
import { isUsableTerm } from '@/lib/terms/standardTerms';

function requireDb() {
  if (!db) throw new Error('Firestore is not configured.');
  return db;
}

/** Firestore batches are capped at 500 writes; stay well under it. */
const BATCH_SIZE = 400;

/**
 * Terms live in their own subcollection, `users/{uid}/terms/{termId}`, like
 * courses, tasks and contacts: one document per term, readable by its owner
 * only, kept live in app state by useFirestoreSync. Same optimistic dispatch,
 * write, roll back on failure pattern as the other lib/firestore modules.
 */
export async function saveTerm(
  userId: string,
  term: Term,
  dispatch: React.Dispatch<AppAction>,
  previousTerm?: Term,
): Promise<void> {
  if (!isUsableTerm(term)) throw new Error('A term needs a label and a valid first and last day.');
  dispatch({ type: previousTerm ? 'UPDATE_TERM' : 'ADD_TERM', payload: term });
  try {
    const batch = writeBatch(requireDb());
    batch.set(doc(requireDb(), 'users', userId, 'terms', term.id), term);
    await batch.commit();
  } catch (err) {
    if (previousTerm) dispatch({ type: 'UPDATE_TERM', payload: previousTerm });
    // A term that was only just created is dropped again by the next terms
    // snapshot, which is the source of truth.
    throw err;
  }
}

/**
 * Writes a migration plan: creates the new terms and gives each linked
 * course its `termId`. Courses are written with a field merge, so nothing
 * else on them (and nothing a concurrent edit just wrote) is replaced.
 */
export async function applyTermMigration(
  userId: string,
  plan: Pick<TermMigrationPlan, 'newTerms' | 'courseLinks'>,
  courses: Course[],
  dispatch: React.Dispatch<AppAction>,
): Promise<void> {
  const database = requireDb();
  plan.newTerms.forEach((term) => dispatch({ type: 'ADD_TERM', payload: term }));
  const byId = new Map(courses.map((c) => [c.id, c]));
  for (const link of plan.courseLinks) {
    const course = byId.get(link.courseId);
    if (course) dispatch({ type: 'UPDATE_COURSE', payload: { ...course, termId: link.termId } });
  }

  const writes: Array<(batch: ReturnType<typeof writeBatch>) => void> = [
    ...plan.newTerms.map((term) => (batch: ReturnType<typeof writeBatch>) => {
      batch.set(doc(database, 'users', userId, 'terms', term.id), term);
    }),
    ...plan.courseLinks.map((link) => (batch: ReturnType<typeof writeBatch>) => {
      batch.set(
        doc(database, 'users', userId, 'courses', link.courseId),
        { termId: link.termId },
        { merge: true },
      );
    }),
  ];
  for (let i = 0; i < writes.length; i += BATCH_SIZE) {
    const batch = writeBatch(database);
    writes.slice(i, i + BATCH_SIZE).forEach((write) => write(batch));
    await batch.commit();
  }
}
