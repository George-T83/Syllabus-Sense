'use client';

import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import type { SyllabusUpload } from '@/types/syllabus';

export function useSyllabi(userId: string | undefined, courseId: string) {
  const [syllabi, setSyllabi] = useState<SyllabusUpload[]>([]);

  useEffect(() => {
    if (!userId || !db) return;
    const unsubscribe = onSnapshot(
      collection(db, 'users', userId, 'courses', courseId, 'syllabi'),
      (snapshot) => setSyllabi(snapshot.docs.map((d) => d.data() as SyllabusUpload)),
    );
    return unsubscribe;
  }, [userId, courseId]);

  return syllabi;
}
