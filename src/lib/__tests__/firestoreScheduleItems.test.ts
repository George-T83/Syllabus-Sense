import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { ScheduleItem } from '@/types/schedule';

const setDocMock = vi.fn();
const deleteDocMock = vi.fn();

vi.mock('@/lib/firebase/client', () => ({ db: {} }));

vi.mock('firebase/firestore', () => ({
  doc: vi.fn((...args: unknown[]) => args.join('/')),
  setDoc: (...args: unknown[]) => setDocMock(...args),
  deleteDoc: (...args: unknown[]) => deleteDocMock(...args),
}));

import {
  createScheduleItem,
  updateScheduleItem,
  deleteScheduleItem,
  reconcileScheduleItems,
  hasPendingItemWrites,
  isPendingDeletion,
  resetPendingWrites,
} from '@/lib/firestore/scheduleItems';

const item: ScheduleItem = {
  id: 'i1',
  courseId: 'c1',
  title: 'HW1',
  type: 'assignment',
  dueDate: '2026-09-01T00:00:00.000Z',
  completed: false,
};

const item2: ScheduleItem = {
  id: 'i2',
  courseId: 'c1',
  title: 'HW2',
  type: 'assignment',
  dueDate: '2026-09-08T00:00:00.000Z',
  completed: false,
};

describe('Firestore schedule items service', () => {
  beforeEach(() => {
    resetPendingWrites();
    setDocMock.mockReset().mockResolvedValue(undefined);
    deleteDocMock.mockReset().mockResolvedValue(undefined);
  });

  it('createScheduleItem dispatches optimistically then writes to Firestore', async () => {
    const dispatch = vi.fn();
    await createScheduleItem('u1', item, dispatch);

    expect(dispatch).toHaveBeenCalledWith({ type: 'ADD_SCHEDULE_ITEM', payload: item });
    expect(setDocMock).toHaveBeenCalledTimes(1);
    expect(hasPendingItemWrites(item.id)).toBe(false);
  });

  it('createScheduleItem rolls back on write failure and clears pending state', async () => {
    setDocMock.mockRejectedValueOnce(new Error('network down'));
    const dispatch = vi.fn();

    await expect(createScheduleItem('u1', item, dispatch)).rejects.toThrow('network down');

    expect(dispatch).toHaveBeenNthCalledWith(2, {
      type: 'REMOVE_SCHEDULE_ITEM',
      payload: item.id,
    });
    expect(hasPendingItemWrites(item.id)).toBe(false);
  });

  it('updateScheduleItem rolls back to the previous item on failure', async () => {
    setDocMock.mockRejectedValueOnce(new Error('offline'));
    const dispatch = vi.fn();
    const updated: ScheduleItem = { ...item, completed: true };

    await expect(updateScheduleItem('u1', item, updated, dispatch)).rejects.toThrow('offline');

    expect(dispatch).toHaveBeenNthCalledWith(1, { type: 'UPDATE_SCHEDULE_ITEM', payload: updated });
    expect(dispatch).toHaveBeenNthCalledWith(2, { type: 'UPDATE_SCHEDULE_ITEM', payload: item });
    expect(hasPendingItemWrites(item.id)).toBe(false);
  });

  it('serializes overlapping updates to the same item instead of racing', async () => {
    let resolveFirstWrite: () => void = () => {};
    const firstWrite = new Promise<void>((resolve) => {
      resolveFirstWrite = resolve;
    });
    setDocMock.mockImplementationOnce(() => firstWrite);
    setDocMock.mockImplementationOnce(() => Promise.resolve());

    const dispatch = vi.fn();
    const toggledOn: ScheduleItem = { ...item, completed: true };
    const toggledOff: ScheduleItem = { ...item, completed: false };

    const firstUpdate = updateScheduleItem('u1', item, toggledOn, dispatch);
    const secondUpdate = updateScheduleItem('u1', toggledOn, toggledOff, dispatch);

    expect(hasPendingItemWrites(item.id)).toBe(true);

    await Promise.resolve();
    await Promise.resolve();
    expect(setDocMock).toHaveBeenCalledTimes(1);

    resolveFirstWrite();
    await firstUpdate;
    await secondUpdate;

    expect(setDocMock).toHaveBeenCalledTimes(2);
    expect(hasPendingItemWrites(item.id)).toBe(false);
  });

  it('deleteScheduleItem rolls back by re-adding the item on failure', async () => {
    deleteDocMock.mockRejectedValueOnce(new Error('denied'));
    const dispatch = vi.fn();

    await expect(deleteScheduleItem('u1', item, dispatch)).rejects.toThrow('denied');

    expect(dispatch).toHaveBeenNthCalledWith(1, {
      type: 'REMOVE_SCHEDULE_ITEM',
      payload: item.id,
    });
    expect(dispatch).toHaveBeenNthCalledWith(2, { type: 'ADD_SCHEDULE_ITEM', payload: item });
    expect(isPendingDeletion(item.id)).toBe(false);
  });

  describe('reconcileScheduleItems (Snapshot Reconciliation)', () => {
    it('returns authoritative remote items when there are no active in-flight writes', () => {
      const remote = [item, item2];
      const local = [item, item2];
      const reconciled = reconcileScheduleItems(remote, local);

      expect(reconciled).toEqual(remote);
    });

    it('preserves local optimistic state when remote snapshot is stale during an in-flight write', () => {
      // Simulate an in-flight update toggling completed: true
      let resolveWrite: () => void = () => {};
      setDocMock.mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            resolveWrite = resolve;
          }),
      );

      const dispatch = vi.fn();
      const toggledOn: ScheduleItem = { ...item, completed: true };
      updateScheduleItem('u1', item, toggledOn, dispatch);

      expect(hasPendingItemWrites(item.id)).toBe(true);

      // Stale remote snapshot arrives with completed: false
      const staleRemoteSnapshot = [{ ...item, completed: false }, item2];
      const localState = [toggledOn, item2];

      const reconciled = reconcileScheduleItems(staleRemoteSnapshot, localState);

      // Item 1 must retain local optimistic completed: true, Item 2 takes remote state
      expect(reconciled.find((it) => it.id === 'i1')?.completed).toBe(true);
      expect(reconciled.find((it) => it.id === 'i2')?.completed).toBe(false);

      resolveWrite();
    });

    it('preserves newly created local items during in-flight creation when snapshot has not yet indexed them', () => {
      let resolveWrite: () => void = () => {};
      setDocMock.mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            resolveWrite = resolve;
          }),
      );

      const dispatch = vi.fn();
      const newItem: ScheduleItem = {
        id: 'new-item-1',
        courseId: 'c1',
        title: 'New Assignment',
        type: 'assignment',
        dueDate: '2026-09-12T00:00:00.000Z',
        completed: false,
      };

      createScheduleItem('u1', newItem, dispatch);

      // Remote snapshot currently only has existing item
      const remoteSnapshot = [item];
      const localState = [item, newItem];

      const reconciled = reconcileScheduleItems(remoteSnapshot, localState);

      expect(reconciled.map((i) => i.id)).toContain('new-item-1');
      expect(reconciled.map((i) => i.id)).toContain('i1');

      resolveWrite();
    });

    it('filters out pending deleted items even if stale remote snapshot still contains them', () => {
      let resolveDelete: () => void = () => {};
      deleteDocMock.mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            resolveDelete = resolve;
          }),
      );

      const dispatch = vi.fn();
      deleteScheduleItem('u1', item, dispatch);

      expect(isPendingDeletion(item.id)).toBe(true);

      // Stale snapshot arrives before deleteDoc commits
      const staleRemoteSnapshot = [item, item2];
      const localState = [item2];

      const reconciled = reconcileScheduleItems(staleRemoteSnapshot, localState);

      expect(reconciled.map((i) => i.id)).not.toContain('i1');
      expect(reconciled.map((i) => i.id)).toContain('i2');

      resolveDelete();
    });
  });
});
