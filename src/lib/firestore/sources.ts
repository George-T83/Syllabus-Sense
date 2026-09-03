import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import type { AppAction } from '@/context/AppStateContext';
import type { Source } from '@/types/source';

function requireDb() {
  if (!db) throw new Error('Firestore is not configured.');
  return db;
}

/**
 * Same optimistic-dispatch-then-write, rollback-on-failure pattern as
 * lib/firestore/contacts.ts.
 */
export async function createSource(
  userId: string,
  source: Source,
  dispatch: React.Dispatch<AppAction>,
): Promise<void> {
  dispatch({ type: 'ADD_SOURCE', payload: source });
  try {
    await setDoc(doc(requireDb(), 'users', userId, 'sources', source.id), source);
  } catch (err) {
    dispatch({ type: 'REMOVE_SOURCE', payload: source.id });
    throw err;
  }
}

export async function updateSource(
  userId: string,
  previousSource: Source,
  updatedSource: Source,
  dispatch: React.Dispatch<AppAction>,
): Promise<void> {
  dispatch({ type: 'UPDATE_SOURCE', payload: updatedSource });
  try {
    await setDoc(doc(requireDb(), 'users', userId, 'sources', updatedSource.id), updatedSource);
  } catch (err) {
    dispatch({ type: 'UPDATE_SOURCE', payload: previousSource });
    throw err;
  }
}

export async function deleteSource(
  userId: string,
  source: Source,
  dispatch: React.Dispatch<AppAction>,
): Promise<void> {
  dispatch({ type: 'REMOVE_SOURCE', payload: source.id });
  try {
    await deleteDoc(doc(requireDb(), 'users', userId, 'sources', source.id));
  } catch (err) {
    dispatch({ type: 'ADD_SOURCE', payload: source });
    throw err;
  }
}
