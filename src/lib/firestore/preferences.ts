'use client';

import { useEffect, useState } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';

export interface UserPreferences {
  dailyDigest: boolean;
  deadlineReminders: boolean;
  weeklyRecap: boolean;
  /** Which TaskRow visual density the student wants used everywhere the
   * app renders a task - 'card' (tinted background, denser info) or
   * 'touch' (top accent bar, large circular checkbox, built for tapping
   * on a phone). Set from Profile; synced the same as every other
   * preference here, so it's realtime and follows the account across
   * devices rather than being a per-browser setting. */
  taskRowVariant: 'card' | 'touch';
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  dailyDigest: true,
  deadlineReminders: true,
  weeklyRecap: false,
  taskRowVariant: 'card',
};

function requireDb() {
  if (!db) throw new Error('Firestore is not configured.');
  return db;
}

/**
 * Stored as a `preferences` field on the user's own root document
 * (`users/{userId}`), not a subcollection - the existing security rule on
 * that document (`request.auth.uid == userId`) already covers it, so no
 * rules changes were needed.
 *
 * Returns a setter alongside the live value so callers can apply the same
 * optimistic-update pattern used by the other Firestore hooks in this app
 * (set local state immediately, write, roll back on failure) - the
 * onSnapshot listener still reconciles with the server value shortly after.
 */
export function useUserPreferences(
  userId: string | undefined,
): [UserPreferences | null, (preferences: UserPreferences) => void] {
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);

  useEffect(() => {
    if (!userId || !db) return;
    const unsubscribe = onSnapshot(doc(db, 'users', userId), (snapshot) => {
      const stored = snapshot.data()?.preferences as Partial<UserPreferences> | undefined;
      setPreferences({ ...DEFAULT_PREFERENCES, ...stored });
    });
    return unsubscribe;
  }, [userId]);

  return [preferences, setPreferences];
}

export async function updateUserPreferences(
  userId: string,
  preferences: UserPreferences,
): Promise<void> {
  await setDoc(doc(requireDb(), 'users', userId), { preferences }, { merge: true });
}
