import { doc, deleteDoc } from 'firebase/firestore';
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
