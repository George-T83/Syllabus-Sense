import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import type { AppAction } from '@/context/AppStateContext';
import type { ScheduleItem } from '@/types/schedule';

function requireDb() {
  if (!db) throw new Error('Firestore is not configured.');
  return db;
}

export async function createScheduleItem(
  userId: string,
  item: ScheduleItem,
  dispatch: React.Dispatch<AppAction>,
): Promise<void> {
  dispatch({ type: 'ADD_SCHEDULE_ITEM', payload: item });
  try {
    await setDoc(doc(requireDb(), 'users', userId, 'scheduleItems', item.id), item);
  } catch (err) {
    dispatch({ type: 'REMOVE_SCHEDULE_ITEM', payload: item.id });
    throw err;
  }
}

export async function updateScheduleItem(
  userId: string,
  previousItem: ScheduleItem,
  updatedItem: ScheduleItem,
  dispatch: React.Dispatch<AppAction>,
): Promise<void> {
  dispatch({ type: 'UPDATE_SCHEDULE_ITEM', payload: updatedItem });
  try {
    await setDoc(doc(requireDb(), 'users', userId, 'scheduleItems', updatedItem.id), updatedItem);
  } catch (err) {
    dispatch({ type: 'UPDATE_SCHEDULE_ITEM', payload: previousItem });
    throw err;
  }
}

export async function deleteScheduleItem(
  userId: string,
  item: ScheduleItem,
  dispatch: React.Dispatch<AppAction>,
): Promise<void> {
  dispatch({ type: 'REMOVE_SCHEDULE_ITEM', payload: item.id });
  try {
    await deleteDoc(doc(requireDb(), 'users', userId, 'scheduleItems', item.id));
  } catch (err) {
    dispatch({ type: 'ADD_SCHEDULE_ITEM', payload: item });
    throw err;
  }
}
