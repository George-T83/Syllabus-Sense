import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import type { AppAction } from '@/context/AppStateContext';
import type { ScheduleItem } from '@/types/schedule';

function requireDb() {
  if (!db) throw new Error('Firestore is not configured.');
  return db;
}

/**
 * Per-item write queue, keyed by schedule item id. Without this, rapid
 * double-clicking a task's checkbox fires two overlapping `setDoc` calls -
 * both carry the full item object (not a partial `completed` patch), so
 * whichever one resolves last on the wire wins regardless of click order,
 * silently diverging Firestore's stored state from what the UI shows.
 * Chaining each update onto the previous one for the same item forces
 * writes to land in the order they were requested instead of racing.
 */
const pendingWrites = new Map<string, Promise<unknown>>();

function enqueueWrite(itemId: string, write: () => Promise<unknown>): Promise<unknown> {
  const previous = pendingWrites.get(itemId) ?? Promise.resolve();
  const run = previous.catch(() => {}).then(write);
  pendingWrites.set(itemId, run);
  // `run` itself is returned to the caller, who awaits and handles its
  // rejection - but `.finally()` derives a *new* promise that re-rejects
  // with the same reason, and nothing here consumes that one. Left
  // dangling, a failed write logs as an unhandled rejection even though
  // the caller already handled the original. Swallow it explicitly since
  // this branch only exists for map cleanup, not error handling.
  run
    .finally(() => {
      if (pendingWrites.get(itemId) === run) pendingWrites.delete(itemId);
    })
    .catch(() => {});
  return run;
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
    await enqueueWrite(updatedItem.id, () =>
      setDoc(doc(requireDb(), 'users', userId, 'scheduleItems', updatedItem.id), updatedItem),
    );
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
