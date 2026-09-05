'use client';

import { useEffect, useState } from 'react';
import { collection, onSnapshot, type FirestoreError } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useToast } from '@/components/ui/Toast';
import type { SyllabusUpload } from '@/types/syllabus';

export function useSyllabi(userId: string | undefined, courseId: string) {
  const [syllabi, setSyllabi] = useState<SyllabusUpload[]>([]);
  const { showError } = useToast();

  useEffect(() => {
    if (!userId || !db) return;
    const unsubscribe = onSnapshot(
      collection(db, 'users', userId, 'courses', courseId, 'syllabi'),
      (snapshot) => setSyllabi(snapshot.docs.map((d) => d.data() as SyllabusUpload)),
      (error: FirestoreError) => {
        // Every other Firestore listener in the app (useFirestoreSync.ts)
        // has an error callback with a matching toast - this one didn't,
        // so a permission or offline error left the syllabus list looking
        // permanently (and silently) empty with no indication anything
        // had gone wrong.
        console.error('[useSyllabi] listener failed:', error);
        showError(
          "Couldn't sync syllabi",
          'Your changes may not be saved. Try refreshing the page.',
        );
      },
    );
    return unsubscribe;
  }, [userId, courseId, showError]);

  return syllabi;
}
