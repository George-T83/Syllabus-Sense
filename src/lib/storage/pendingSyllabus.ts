import { pendingUploadPrefix } from '@/lib/syllabus/pendingUpload';
import { syllabusContentType } from '@/lib/validation/syllabusFile';

/**
 * Puts a big syllabus in Storage so the extract route can read it from there.
 * Returns the path to send to the route. The route deletes the file once read.
 */
export async function uploadPendingSyllabus(userId: string, file: File): Promise<string> {
  const { ref, uploadBytes } = await import('firebase/storage');
  const { storage } = await import('@/lib/firebase/client');
  if (!storage) throw new Error('Storage is not configured.');

  const storagePath = `${pendingUploadPrefix(userId)}${crypto.randomUUID()}-${file.name}`;
  await uploadBytes(ref(storage, storagePath), file, { contentType: syllabusContentType(file) });
  return storagePath;
}

/** Best effort: the route normally has deleted it already. */
export async function discardPendingSyllabus(storagePath: string): Promise<void> {
  try {
    const { ref, deleteObject } = await import('firebase/storage');
    const { storage } = await import('@/lib/firebase/client');
    if (!storage) return;
    await deleteObject(ref(storage, storagePath));
  } catch {
    // Already gone, or offline; nothing the student needs to know.
  }
}
