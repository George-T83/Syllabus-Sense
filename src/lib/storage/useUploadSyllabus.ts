'use client';

import { useCallback, useRef, useState } from 'react';
import { ref, uploadBytesResumable, getDownloadURL, type UploadTask } from 'firebase/storage';
import { doc, setDoc } from 'firebase/firestore';
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
              };
              await setDoc(
                doc(dbInstance, 'users', userId, 'courses', courseId, 'syllabi', id),
                record,
              );
              setState({ status: 'success', progress: 100, error: null });
              resolve(record);
            } catch (err) {
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
