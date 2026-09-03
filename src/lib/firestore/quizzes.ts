import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import type { AppAction } from '@/context/AppStateContext';
import type { Quiz, QuizAttempt } from '@/types/quiz';

function requireDb() {
  if (!db) throw new Error('Firestore is not configured.');
  return db;
}

export async function createQuiz(
  userId: string,
  quiz: Quiz,
  dispatch: React.Dispatch<AppAction>,
): Promise<void> {
  dispatch({ type: 'ADD_QUIZ', payload: quiz });
  try {
    await setDoc(doc(requireDb(), 'users', userId, 'quizzes', quiz.id), quiz);
  } catch (err) {
    dispatch({ type: 'REMOVE_QUIZ', payload: quiz.id });
    throw err;
  }
}

export async function deleteQuiz(
  userId: string,
  quiz: Quiz,
  dispatch: React.Dispatch<AppAction>,
): Promise<void> {
  dispatch({ type: 'REMOVE_QUIZ', payload: quiz.id });
  try {
    await deleteDoc(doc(requireDb(), 'users', userId, 'quizzes', quiz.id));
  } catch (err) {
    dispatch({ type: 'ADD_QUIZ', payload: quiz });
    throw err;
  }
}

export async function createQuizAttempt(
  userId: string,
  attempt: QuizAttempt,
  dispatch: React.Dispatch<AppAction>,
): Promise<void> {
  dispatch({ type: 'ADD_QUIZ_ATTEMPT', payload: attempt });
  try {
    await setDoc(doc(requireDb(), 'users', userId, 'quizAttempts', attempt.id), attempt);
  } catch (err) {
    dispatch({ type: 'REMOVE_QUIZ_ATTEMPT', payload: attempt.id });
    throw err;
  }
}
