import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import type { AppAction } from '@/context/AppStateContext';
import type { ScheduleItem } from '@/types/schedule';

function requireDb() {
  if (!db) throw new Error('Firestore is not configured.');
  return db;
}

interface PendingWriteEntry {
  promise: Promise<unknown>;
  latestItem?: ScheduleItem;
  pendingCount: number;
}

/**
 * Per-item write queue, keyed by schedule item id. Without this, rapid
 * double-clicking a task's checkbox fires overlapping `setDoc` calls -
 * both carry the full item object (not a partial `completed` patch), so
 * whichever one resolves last on the wire wins regardless of click order,
 * silently diverging Firestore's stored state from what the UI shows.
 * Chaining each update onto the previous one for the same item forces
 * writes to land in the order they were requested instead of racing.
 */
const pendingWrites = new Map<string, PendingWriteEntry>();
const pendingDeletions = new Set<string>();

/**
 * Checks if an item currently has any in-flight write operations.
 */
export function hasPendingItemWrites(itemId: string): boolean {
  return (pendingWrites.get(itemId)?.pendingCount ?? 0) > 0 || pendingDeletions.has(itemId);
}

/**
 * Checks if an item has a deletion in flight.
 */
export function isPendingDeletion(itemId: string): boolean {
  return pendingDeletions.has(itemId);
}

/**
 * Retrieves the latest in-flight optimistic item state if one exists.
 */
export function getLatestPendingItem(itemId: string): ScheduleItem | undefined {
  return pendingWrites.get(itemId)?.latestItem;
}

/**
 * Resets in-memory write queues (used for test isolation).
 */
export function resetPendingWrites(): void {
  pendingWrites.clear();
  pendingDeletions.clear();
}

function enqueueWrite(
  itemId: string,
  item: ScheduleItem,
  write: () => Promise<unknown>,
): Promise<unknown> {
  const existing = pendingWrites.get(itemId);
  const previous = existing?.promise ?? Promise.resolve();
  const currentCount = (existing?.pendingCount ?? 0) + 1;

  const run = previous.catch(() => {}).then(write);

  const entry: PendingWriteEntry = {
    promise: run,
    latestItem: item,
    pendingCount: currentCount,
  };
  pendingWrites.set(itemId, entry);

  // Derive cleanup handler
  run
    .finally(() => {
      const current = pendingWrites.get(itemId);
      if (current) {
        current.pendingCount -= 1;
        if (current.pendingCount <= 0 || current.promise === run) {
          pendingWrites.delete(itemId);
        }
      }
    })
    .catch(() => {});

  return run;
}

/**
 * Reconciles incoming remote Firestore snapshot items with active local state.
 * If an item has an in-flight write or deletion, the local optimistic state is
 * preserved so rapid toggles and completions never flicker or revert to stale data.
 */
export function reconcileScheduleItems(
  remoteItems: ScheduleItem[],
  localItems: ScheduleItem[] = [],
): ScheduleItem[] {
  const remoteMap = new Map(remoteItems.map((it) => [it.id, it]));
  const localMap = new Map(localItems.map((it) => [it.id, it]));
  const reconciled: ScheduleItem[] = [];

  for (const remoteItem of remoteItems) {
    if (pendingDeletions.has(remoteItem.id)) {
      continue;
    }

    if (hasPendingItemWrites(remoteItem.id)) {
      const localItem =
        localMap.get(remoteItem.id) ?? getLatestPendingItem(remoteItem.id) ?? remoteItem;
      reconciled.push(localItem);
    } else {
      reconciled.push(remoteItem);
    }
  }

  for (const localItem of localItems) {
    if (
      !remoteMap.has(localItem.id) &&
      hasPendingItemWrites(localItem.id) &&
      !pendingDeletions.has(localItem.id)
    ) {
      reconciled.push(localItem);
    }
  }

  return reconciled;
}

export async function createScheduleItem(
  userId: string,
  item: ScheduleItem,
  dispatch: React.Dispatch<AppAction>,
): Promise<void> {
  dispatch({ type: 'ADD_SCHEDULE_ITEM', payload: item });
  try {
    await enqueueWrite(item.id, item, () =>
      setDoc(doc(requireDb(), 'users', userId, 'scheduleItems', item.id), item),
    );
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
    await enqueueWrite(updatedItem.id, updatedItem, () =>
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
  pendingDeletions.add(item.id);
  try {
    await deleteDoc(doc(requireDb(), 'users', userId, 'scheduleItems', item.id));
  } catch (err) {
    dispatch({ type: 'ADD_SCHEDULE_ITEM', payload: item });
    throw err;
  } finally {
    pendingDeletions.delete(item.id);
  }
}
