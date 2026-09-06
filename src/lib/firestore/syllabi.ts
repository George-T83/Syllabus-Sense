import { collection, doc, deleteDoc, getDocs, writeBatch } from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { db, storage } from '@/lib/firebase/client';
import type { SyllabusUpload } from '@/types/syllabus';

/**
 * The syllabus that represents a course's current state: whichever upload
 * is marked primary, or - for courses whose uploads all predate the
 * `isPrimary` field - the most recently uploaded one. The single source of
 * truth for "which syllabus" across the version list, AI summary, and
 * re-extraction, so marking an older upload primary is honored everywhere,
 * not just in the version list's own badge.
 */
export function getPrimarySyllabus(syllabi: SyllabusUpload[]): SyllabusUpload | undefined {
  if (syllabi.length === 0) return undefined;
  const explicitPrimary = syllabi.find((s) => s.isPrimary);
  if (explicitPrimary) return explicitPrimary;
  return [...syllabi].sort(
    (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime(),
  )[0];
}

/**
 * Marks one syllabus upload as the course's primary version and demotes any
 * other upload currently marked primary - at most one `isPrimary: true` per
 * course at a time.
 */
export async function setPrimarySyllabus(
  userId: string,
  courseId: string,
  syllabusId: string,
): Promise<void> {
  if (!db) throw new Error('Firestore is not configured.');
  const collectionRef = collection(db, 'users', userId, 'courses', courseId, 'syllabi');
  const snap = await getDocs(collectionRef);
  const batch = writeBatch(db);
  snap.docs.forEach((d) => {
    const shouldBePrimary = d.id === syllabusId;
    if (Boolean((d.data() as SyllabusUpload).isPrimary) !== shouldBePrimary) {
      batch.update(d.ref, { isPrimary: shouldBePrimary });
    }
  });
  await batch.commit();
}

export async function deleteSyllabusUpload(
  userId: string,
  syllabus: SyllabusUpload,
): Promise<void> {
  if (!db || !storage) throw new Error('Storage is not configured.');
  await deleteDoc(doc(db, 'users', userId, 'courses', syllabus.courseId, 'syllabi', syllabus.id));
  // The Firestore record is the source of truth for the UI; a storage object
  // that's already gone (e.g. cleaned up once before) shouldn't block delete.
  await deleteObject(ref(storage, syllabus.storagePath)).catch(() => {});
}

/**
 * Deletes all syllabus uploads and their corresponding Firebase Storage files
 * for a specific course.
 */
export async function deleteAllCourseSyllabi(userId: string, courseId: string): Promise<void> {
  if (!db) throw new Error('Firestore is not configured.');
  const snap = await getDocs(collection(db, 'users', userId, 'courses', courseId, 'syllabi'));
  const cleanupTasks = snap.docs.map(async (d) => {
    const data = d.data() as Partial<SyllabusUpload>;
    if (storage && data?.storagePath) {
      await deleteObject(ref(storage, data.storagePath)).catch(() => {});
    }
    await deleteDoc(d.ref).catch(() => {});
  });
  await Promise.all(cleanupTasks);
}
