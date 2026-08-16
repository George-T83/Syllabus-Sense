'use client';

import { useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useAuth } from '@/context/AuthContext';
import { useAppState } from '@/context/AppStateContext';
import type { Course, ScheduleItem } from '@/types/schedule';

/**
 * Keeps AppStateContext live-synced with the signed-in user's Firestore data.
 * The optimistic dispatches in lib/firestore/{courses,scheduleItems}.ts give
 * instant feedback; this listener is what makes that data survive a refresh.
 */
export function useFirestoreSync() {
  const { user } = useAuth();
  const { dispatch } = useAppState();

  useEffect(() => {
    if (!user || !db) return;

    const unsubCourses = onSnapshot(collection(db, 'users', user.uid, 'courses'), (snapshot) => {
      dispatch({ type: 'SET_COURSES', payload: snapshot.docs.map((d) => d.data() as Course) });
    });
    const unsubItems = onSnapshot(
      collection(db, 'users', user.uid, 'scheduleItems'),
      (snapshot) => {
        dispatch({
          type: 'SET_SCHEDULE_ITEMS',
          payload: snapshot.docs.map((d) => d.data() as ScheduleItem),
        });
      },
    );

    return () => {
      unsubCourses();
      unsubItems();
    };
  }, [user, dispatch]);
}
