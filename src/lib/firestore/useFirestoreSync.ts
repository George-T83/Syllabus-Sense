'use client';

import { useEffect } from 'react';
import { collection, doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useAuth } from '@/context/AuthContext';
import { useAppState } from '@/context/AppStateContext';
import { DEFAULT_PREFERENCES, type UserPreferences } from '@/lib/firestore/preferences';
import type { Contact, Course, ScheduleItem } from '@/types/schedule';

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
    const unsubContacts = onSnapshot(collection(db, 'users', user.uid, 'contacts'), (snapshot) => {
      dispatch({ type: 'SET_CONTACTS', payload: snapshot.docs.map((d) => d.data() as Contact) });
    });
    // Same doc ProfileView writes to via updateUserPreferences - kept here
    // instead of a separate listener per consumer, so a change (from this
    // device or another) reaches every view that reads state.preferences
    // through the one realtime subscription.
    const unsubPreferences = onSnapshot(doc(db, 'users', user.uid), (snapshot) => {
      const stored = snapshot.data()?.preferences as Partial<UserPreferences> | undefined;
      dispatch({ type: 'SET_PREFERENCES', payload: { ...DEFAULT_PREFERENCES, ...stored } });
    });

    return () => {
      unsubCourses();
      unsubItems();
      unsubContacts();
      unsubPreferences();
    };
  }, [user, dispatch]);
}
