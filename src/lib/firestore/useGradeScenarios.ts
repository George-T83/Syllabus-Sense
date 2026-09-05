'use client';

import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import type { GradeScenario } from '@/types/gradeScenario';

export function useGradeScenarios(userId: string | undefined, courseId: string) {
  const [scenarios, setScenarios] = useState<GradeScenario[]>([]);

  useEffect(() => {
    if (!userId || !courseId || !db) return;
    const unsubscribe = onSnapshot(
      collection(db, 'users', userId, 'courses', courseId, 'gradeScenarios'),
      (snapshot) => setScenarios(snapshot.docs.map((d) => d.data() as GradeScenario)),
    );
    return unsubscribe;
  }, [userId, courseId]);

  return scenarios;
}
