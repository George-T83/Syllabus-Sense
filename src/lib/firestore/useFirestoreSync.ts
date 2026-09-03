'use client';

import { useEffect, useRef } from 'react';
import { collection, doc, onSnapshot, type FirestoreError } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useAuth } from '@/context/AuthContext';
import { useAppState } from '@/context/AppStateContext';
import { useToast } from '@/components/ui/Toast';
import { DEFAULT_PREFERENCES, type UserPreferences } from '@/lib/firestore/preferences';
import { reconcileScheduleItems } from '@/lib/firestore/scheduleItems';
import type { Contact, Course, ScheduleItem } from '@/types/schedule';
import type { Source } from '@/types/source';
import { mockCourses, mockScheduleItems } from '@/lib/mock-data';

/**
 * Keeps AppStateContext live-synced with the signed-in user's Firestore data.
 * The optimistic dispatches in lib/firestore/{courses,scheduleItems}.ts give
 * instant feedback; this listener is what makes that data survive a refresh.
 */
export function useFirestoreSync() {
  const { user } = useAuth();
  const { state, dispatch } = useAppState();
  const { showError } = useToast();
  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    if (!user || !db) return;

    const onSyncError = (label: string) => (error: FirestoreError) => {
      console.error(`[useFirestoreSync] ${label} listener failed:`, error);
      showError(
        `Couldn't sync your ${label}`,
        'Your changes may not be saved. Try refreshing the page.',
      );
    };
    if (
      process.env.NODE_ENV !== 'production' &&
      typeof window !== 'undefined' &&
      window.localStorage.getItem('mock_auth') === 'true'
    ) {
      if (!stateRef.current.initialized) {
        dispatch({ type: 'SET_COURSES', payload: mockCourses });
        dispatch({ type: 'SET_SCHEDULE_ITEMS', payload: mockScheduleItems });
      }
      return;
    }

    const unsubCourses = onSnapshot(
      collection(db, 'users', user.uid, 'courses'),
      (snapshot) => {
        dispatch({ type: 'SET_COURSES', payload: snapshot.docs.map((d) => d.data() as Course) });
      },
      onSyncError('courses'),
    );
    const unsubItems = onSnapshot(
      collection(db, 'users', user.uid, 'scheduleItems'),
      (snapshot) => {
        const remoteItems = snapshot.docs.map((d) => d.data() as ScheduleItem);
        const reconciled = reconcileScheduleItems(remoteItems, stateRef.current.scheduleItems);
        dispatch({
          type: 'SET_SCHEDULE_ITEMS',
          payload: reconciled,
        });
      },
      onSyncError('tasks'),
    );
    const unsubContacts = onSnapshot(
      collection(db, 'users', user.uid, 'contacts'),
      (snapshot) => {
        dispatch({ type: 'SET_CONTACTS', payload: snapshot.docs.map((d) => d.data() as Contact) });
      },
      onSyncError('contacts'),
    );
    const unsubSources = onSnapshot(
      collection(db, 'users', user.uid, 'sources'),
      (snapshot) => {
        dispatch({ type: 'SET_SOURCES', payload: snapshot.docs.map((d) => d.data() as Source) });
      },
      onSyncError('sources'),
    );
    // Same doc ProfileView writes to via updateUserPreferences - kept here
    // instead of a separate listener per consumer, so a change (from this
    // device or another) reaches every view that reads state.preferences
    // through the one realtime subscription.
    const unsubPreferences = onSnapshot(
      doc(db, 'users', user.uid),
      (snapshot) => {
        const stored = snapshot.data()?.preferences as Partial<UserPreferences> | undefined;
        dispatch({ type: 'SET_PREFERENCES', payload: { ...DEFAULT_PREFERENCES, ...stored } });
      },
      onSyncError('preferences'),
    );

    return () => {
      unsubCourses();
      unsubItems();
      unsubContacts();
      unsubSources();
      unsubPreferences();
    };
  }, [user, dispatch, showError]);
}
