import { collection, doc, deleteDoc, getDocs } from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { db, storage } from '@/lib/firebase/client';
import type { SyllabusUpload } from '@/types/syllabus';

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
