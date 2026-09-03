import { doc, setDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import type { AppAction } from '@/context/AppStateContext';
import type { Flashcard } from '@/types/flashcard';

function requireDb() {
  if (!db) throw new Error('Firestore is not configured.');
  return db;
}

export async function createFlashcard(
  userId: string,
  card: Flashcard,
  dispatch: React.Dispatch<AppAction>,
): Promise<void> {
  dispatch({ type: 'ADD_FLASHCARD', payload: card });
  try {
    await setDoc(doc(requireDb(), 'users', userId, 'flashcards', card.id), card);
  } catch (err) {
    dispatch({ type: 'REMOVE_FLASHCARD', payload: card.id });
    throw err;
  }
}

/** Writes an AI-generated deck in one atomic batch - a partial network
 * failure can't leave half a deck saved. */
export async function createFlashcards(
  userId: string,
  cards: Flashcard[],
  dispatch: React.Dispatch<AppAction>,
): Promise<void> {
  if (cards.length === 0) return;
  dispatch({ type: 'ADD_FLASHCARDS', payload: cards });
  try {
    const database = requireDb();
    const batch = writeBatch(database);
    cards.forEach((card) => {
      batch.set(doc(database, 'users', userId, 'flashcards', card.id), card);
    });
    await batch.commit();
  } catch (err) {
    cards.forEach((card) => dispatch({ type: 'REMOVE_FLASHCARD', payload: card.id }));
    throw err;
  }
}

export async function updateFlashcard(
  userId: string,
  previousCard: Flashcard,
  updatedCard: Flashcard,
  dispatch: React.Dispatch<AppAction>,
): Promise<void> {
  dispatch({ type: 'UPDATE_FLASHCARD', payload: updatedCard });
  try {
    await setDoc(doc(requireDb(), 'users', userId, 'flashcards', updatedCard.id), updatedCard);
  } catch (err) {
    dispatch({ type: 'UPDATE_FLASHCARD', payload: previousCard });
    throw err;
  }
}

export async function deleteFlashcard(
  userId: string,
  card: Flashcard,
  dispatch: React.Dispatch<AppAction>,
): Promise<void> {
  dispatch({ type: 'REMOVE_FLASHCARD', payload: card.id });
  try {
    await deleteDoc(doc(requireDb(), 'users', userId, 'flashcards', card.id));
  } catch (err) {
    dispatch({ type: 'ADD_FLASHCARD', payload: card });
    throw err;
  }
}
