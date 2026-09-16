'use client';

import { useEffect, useRef } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  type Firestore,
  type FirestoreError,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useAuth } from '@/context/AuthContext';
import { useAppState } from '@/context/AppStateContext';
import { useToast } from '@/components/ui/Toast';
import { DEFAULT_PREFERENCES, type UserPreferences } from '@/lib/firestore/preferences';
import { reconcileScheduleItems } from '@/lib/firestore/scheduleItems';
import { reconcileCourses } from '@/lib/firestore/courses';
import type { Contact, Course, ScheduleItem } from '@/types/schedule';
import type { Source } from '@/types/source';
import type { Flashcard } from '@/types/flashcard';
import type { Quiz, QuizAttempt } from '@/types/quiz';
import type { MoodEntry } from '@/types/mood';
import { mockCourses, mockScheduleItems } from '@/lib/mock-data';

/**
 * Subscribes to `users/{userId}/{collectionName}` and hands every snapshot's
 * docs to `onDocs`, typed as `T[]`. Covers the plain "map docs, dispatch"
 * shape shared by contacts/sources/flashcards/quizzes/quizAttempts/
 * moodEntries - courses and scheduleItems need their own listener since they
 * reconcile against in-flight optimistic state first, and preferences reads
 * a single doc rather than a collection, so neither goes through this.
 */
function subscribeCollection<T>(
  db: Firestore,
  userId: string,
  collectionName: string,
  onDocs: (docs: T[]) => void,
  onSyncError: (error: FirestoreError) => void,
): () => void {
  return onSnapshot(
    collection(db, 'users', userId, collectionName),
    (snapshot) => onDocs(snapshot.docs.map((d) => d.data() as T)),
    onSyncError,
  );
}

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
        const remoteCourses = snapshot.docs.map((d) => d.data() as Course);
        const reconciled = reconcileCourses(remoteCourses, stateRef.current.courses);
        dispatch({ type: 'SET_COURSES', payload: reconciled });
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
    const unsubContacts = subscribeCollection<Contact>(
      db,
      user.uid,
      'contacts',
      (docs) => dispatch({ type: 'SET_CONTACTS', payload: docs }),
      onSyncError('contacts'),
    );
    const unsubSources = subscribeCollection<Source>(
      db,
      user.uid,
      'sources',
      (docs) => dispatch({ type: 'SET_SOURCES', payload: docs }),
      onSyncError('sources'),
    );
    const unsubFlashcards = subscribeCollection<Flashcard>(
      db,
      user.uid,
      'flashcards',
      (docs) => dispatch({ type: 'SET_FLASHCARDS', payload: docs }),
      onSyncError('flashcards'),
    );
    const unsubQuizzes = subscribeCollection<Quiz>(
      db,
      user.uid,
      'quizzes',
      (docs) => dispatch({ type: 'SET_QUIZZES', payload: docs }),
      onSyncError('quizzes'),
    );
    const unsubQuizAttempts = subscribeCollection<QuizAttempt>(
      db,
      user.uid,
      'quizAttempts',
      (docs) => dispatch({ type: 'SET_QUIZ_ATTEMPTS', payload: docs }),
      onSyncError('quiz attempts'),
    );
    const unsubMoodEntries = subscribeCollection<MoodEntry>(
      db,
      user.uid,
      'moodEntries',
      (docs) => dispatch({ type: 'SET_MOOD_ENTRIES', payload: docs }),
      onSyncError('mood entries'),
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
      unsubFlashcards();
      unsubQuizzes();
      unsubQuizAttempts();
      unsubMoodEntries();
      unsubPreferences();
    };
  }, [user, dispatch, showError]);
}
