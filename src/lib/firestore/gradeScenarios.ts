import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import type { GradeScenario } from '@/types/gradeScenario';

export async function saveGradeScenario(
  userId: string,
  courseId: string,
  scenario: Omit<GradeScenario, 'id' | 'createdAt' | 'courseId'>,
): Promise<GradeScenario> {
  if (!db) throw new Error('Firestore is not configured.');
  const id = crypto.randomUUID();
  const record: GradeScenario = {
    ...scenario,
    id,
    courseId,
    createdAt: new Date().toISOString(),
  };
  await setDoc(doc(db, 'users', userId, 'courses', courseId, 'gradeScenarios', id), record);
  return record;
}

export async function deleteGradeScenario(
  userId: string,
  courseId: string,
  scenarioId: string,
): Promise<void> {
  if (!db) throw new Error('Firestore is not configured.');
  await deleteDoc(doc(db, 'users', userId, 'courses', courseId, 'gradeScenarios', scenarioId));
}
