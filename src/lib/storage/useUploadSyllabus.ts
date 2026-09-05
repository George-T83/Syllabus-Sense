'use client';

import { useCallback, useRef, useState } from 'react';
import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
  type UploadTask,
} from 'firebase/storage';
import { collection, doc, getDocs, writeBatch } from 'firebase/firestore';
import { storage, db } from '@/lib/firebase/client';
import type { SyllabusUpload } from '@/types/syllabus';

export type UploadStatus = 'idle' | 'uploading' | 'paused' | 'success' | 'error' | 'cancelled';

interface UploadState {
  status: UploadStatus;
  progress: number;
  error: string | null;
}

export function useUploadSyllabus(userId: string, courseId: string) {
  const [state, setState] = useState<UploadState>({ status: 'idle', progress: 0, error: null });
  const taskRef = useRef<UploadTask | null>(null);

  const upload = useCallback(
    (file: File): Promise<SyllabusUpload> => {
      const storageInstance = storage;
      const dbInstance = db;

      return new Promise((resolve, reject) => {
        if (!storageInstance || !dbInstance) {
          const message = 'Storage is not configured.';
          setState({ status: 'error', progress: 0, error: message });
          reject(new Error(message));
          return;
        }

        const id = crypto.randomUUID();
        const storagePath = `users/${userId}/syllabi/${courseId}/${id}-${file.name}`;
        const task = uploadBytesResumable(ref(storageInstance, storagePath), file);
        taskRef.current = task;
        setState({ status: 'uploading', progress: 0, error: null });

        task.on(
          'state_changed',
          (snapshot) => {
            const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
            setState((s) => ({
              ...s,
              progress,
              status: snapshot.state === 'paused' ? 'paused' : 'uploading',
            }));
          },
          (err) => {
            const cancelled = err.code === 'storage/canceled';
            setState({
              status: cancelled ? 'cancelled' : 'error',
              progress: 0,
              error: cancelled ? null : err.message,
            });
            reject(err);
          },
          async () => {
            try {
              const downloadURL = await getDownloadURL(task.snapshot.ref);
              const record: SyllabusUpload = {
                id,
                courseId,
                fileName: file.name,
                storagePath,
                downloadURL,
                sizeBytes: file.size,
                uploadedAt: new Date().toISOString(),
                isPrimary: true,
              };
              const collectionRef = collection(
                dbInstance,
                'users',
                userId,
                'courses',
                courseId,
                'syllabi',
              );
              // The most recently uploaded syllabus becomes the course's
              // primary version by default - demote whichever upload held
              // that spot before, in the same batch as creating the new
              // record.
              const existing = await getDocs(collectionRef);
              const batch = writeBatch(dbInstance);
              existing.docs.forEach((d) => {
                if ((d.data() as SyllabusUpload).isPrimary) {
                  batch.update(d.ref, { isPrimary: false });
                }
              });
              batch.set(doc(collectionRef, id), record);
              await batch.commit();
              setState({ status: 'success', progress: 100, error: null });
              resolve(record);
            } catch (err) {
              // The file made it to Storage but the Firestore record failed -
              // without this it would be an orphaned file with nothing
              // referencing it, invisible to the UI but still costing storage.
              await deleteObject(task.snapshot.ref).catch(() => {});
              setState({
                status: 'error',
                progress: 0,
                error: err instanceof Error ? err.message : 'Failed to save upload record.',
              });
              reject(err);
            }
          },
        );
      });
    },
    [userId, courseId],
  );

  const pause = useCallback(() => taskRef.current?.pause(), []);
  const resume = useCallback(() => taskRef.current?.resume(), []);
  const cancel = useCallback(() => taskRef.current?.cancel(), []);
  const reset = useCallback(() => setState({ status: 'idle', progress: 0, error: null }), []);

  return { ...state, upload, pause, resume, cancel, reset };
}
