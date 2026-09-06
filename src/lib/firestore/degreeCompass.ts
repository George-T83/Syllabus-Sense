import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import type { DegreeCourse, DegreeProfile } from '@/types/degreeCompass';

/** Singleton doc id - one profile per user, same shape as any other
 * account-level singleton in this codebase (e.g. preferences.ts). */
const PROFILE_DOC_ID = 'profile';

function requireDb() {
  if (!db) throw new Error('Firestore is not configured.');
  return db;
}

export async function saveDegreeProfile(
  userId: string,
  profile: Omit<DegreeProfile, 'updatedAt'>,
): Promise<DegreeProfile> {
  const record: DegreeProfile = { ...profile, updatedAt: new Date().toISOString() };
  // Firestore's setDoc rejects `undefined` field values outright, so a
  // student with no minor (minorName left unset) must omit the key
  // entirely rather than write it as undefined.
  if (!record.minorName) delete record.minorName;
  await setDoc(doc(requireDb(), 'users', userId, 'degreeProfile', PROFILE_DOC_ID), record);
  return record;
}

export async function saveDegreeCourse(
  userId: string,
  course: Omit<DegreeCourse, 'id'> & { id?: string },
): Promise<DegreeCourse> {
  const id = course.id ?? crypto.randomUUID();
  const record: DegreeCourse = { ...course, id };
  await setDoc(doc(requireDb(), 'users', userId, 'degreeCourses', id), record);
  return record;
}

export async function deleteDegreeCourse(userId: string, courseId: string): Promise<void> {
  await deleteDoc(doc(requireDb(), 'users', userId, 'degreeCourses', courseId));
}
