'use client';

import { useEffect, useState } from 'react';
import { collection, onSnapshot, type FirestoreError } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useToast } from '@/components/ui/Toast';
import type { GradeScenario } from '@/types/gradeScenario';

export function useGradeScenarios(userId: string | undefined, courseId: string) {
  const [scenarios, setScenarios] = useState<GradeScenario[]>([]);
  const { showError } = useToast();

  useEffect(() => {
    if (!userId || !courseId || !db) return;
    const unsubscribe = onSnapshot(
      collection(db, 'users', userId, 'courses', courseId, 'gradeScenarios'),
      (snapshot) => setScenarios(snapshot.docs.map((d) => d.data() as GradeScenario)),
      (error: FirestoreError) => {
        // Every other Firestore listener in the app (useFirestoreSync.ts)
        // has an error callback with a matching toast - this one didn't,
        // so a permission or offline error left saved grade scenarios
        // looking permanently (and silently) empty with no indication
        // anything had gone wrong.
        console.error('[useGradeScenarios] listener failed:', error);
        showError(
          "Couldn't sync grade scenarios",
          'Your changes may not be saved. Try refreshing the page.',
        );
      },
    );
    return unsubscribe;
  }, [userId, courseId, showError]);

  return scenarios;
}
