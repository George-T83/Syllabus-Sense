'use client';

import { useEffect, useState } from 'react';
import { doc, collection, onSnapshot, type FirestoreError } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useToast } from '@/components/ui/Toast';
import type { DegreeCourse, DegreeProfile } from '@/types/degreeCompass';

const PROFILE_DOC_ID = 'profile';

export function useDegreeProfile(userId: string | undefined): {
  profile: DegreeProfile | null;
  loading: boolean;
} {
  const [profile, setProfile] = useState<DegreeProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const { showError } = useToast();

  useEffect(() => {
    if (!userId || !db) {
      setLoading(false);
      return;
    }
    const unsubscribe = onSnapshot(
      doc(db, 'users', userId, 'degreeProfile', PROFILE_DOC_ID),
      (snapshot) => {
        setProfile(snapshot.exists() ? (snapshot.data() as DegreeProfile) : null);
        setLoading(false);
      },
      (error: FirestoreError) => {
        console.error('[useDegreeProfile] listener failed:', error);
        showError("Couldn't sync your degree profile", 'Try refreshing the page.');
        setLoading(false);
      },
    );
    return unsubscribe;
  }, [userId, showError]);

  return { profile, loading };
}

export function useDegreeCourses(userId: string | undefined): DegreeCourse[] {
  const [courses, setCourses] = useState<DegreeCourse[]>([]);
  const { showError } = useToast();

  useEffect(() => {
    if (!userId || !db) return;
    const unsubscribe = onSnapshot(
      collection(db, 'users', userId, 'degreeCourses'),
      (snapshot) => setCourses(snapshot.docs.map((d) => d.data() as DegreeCourse)),
      (error: FirestoreError) => {
        console.error('[useDegreeCourses] listener failed:', error);
        showError(
          "Couldn't sync your degree courses",
          'Your changes may not be saved. Try refreshing the page.',
        );
      },
    );
    return unsubscribe;
  }, [userId, showError]);

  return courses;
}
