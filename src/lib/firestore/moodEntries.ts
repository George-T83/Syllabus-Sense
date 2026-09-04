import { doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import type { AppAction } from '@/context/AppStateContext';
import type { MoodEntry } from '@/types/mood';

function requireDb() {
  if (!db) throw new Error('Firestore is not configured.');
  return db;
}

/**
 * One check-in per day - re-tapping the same day overwrites the previous
 * value (doc id is the day key itself), so this is always a plain upsert,
 * never an add-alongside-existing-entries. Same optimistic-dispatch-then-
 * write, rollback-on-failure pattern as lib/firestore/contacts.ts.
 */
export async function upsertMoodEntry(
  userId: string,
  entry: MoodEntry,
  dispatch: React.Dispatch<AppAction>,
  previousEntry?: MoodEntry,
): Promise<void> {
  dispatch({ type: 'UPSERT_MOOD_ENTRY', payload: entry });
  try {
    await setDoc(doc(requireDb(), 'users', userId, 'moodEntries', entry.id), entry);
  } catch (err) {
    if (previousEntry) {
      dispatch({ type: 'UPSERT_MOOD_ENTRY', payload: previousEntry });
    } else {
      dispatch({ type: 'REMOVE_MOOD_ENTRY', payload: entry.id });
    }
    throw err;
  }
}
