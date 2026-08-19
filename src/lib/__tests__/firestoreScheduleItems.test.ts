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
} from '@/lib/firestore/scheduleItems';

const item: ScheduleItem = {
  id: 'i1',
  courseId: 'c1',
  title: 'HW1',
  type: 'assignment',
  dueDate: '2026-09-01T00:00:00.000Z',
  completed: false,
};

describe('Firestore schedule items service', () => {
  beforeEach(() => {
    setDocMock.mockReset().mockResolvedValue(undefined);
    deleteDocMock.mockReset().mockResolvedValue(undefined);
  });

  it('createScheduleItem dispatches optimistically then writes to Firestore', async () => {
    const dispatch = vi.fn();
    await createScheduleItem('u1', item, dispatch);

    expect(dispatch).toHaveBeenCalledWith({ type: 'ADD_SCHEDULE_ITEM', payload: item });
    expect(setDocMock).toHaveBeenCalledTimes(1);
  });

  it('createScheduleItem rolls back on write failure', async () => {
    setDocMock.mockRejectedValueOnce(new Error('network down'));
    const dispatch = vi.fn();

    await expect(createScheduleItem('u1', item, dispatch)).rejects.toThrow('network down');

    expect(dispatch).toHaveBeenNthCalledWith(2, {
      type: 'REMOVE_SCHEDULE_ITEM',
      payload: item.id,
    });
  });

  it('updateScheduleItem rolls back to the previous item on failure', async () => {
    setDocMock.mockRejectedValueOnce(new Error('offline'));
    const dispatch = vi.fn();
    const updated: ScheduleItem = { ...item, completed: true };

    await expect(updateScheduleItem('u1', item, updated, dispatch)).rejects.toThrow('offline');

    expect(dispatch).toHaveBeenNthCalledWith(1, { type: 'UPDATE_SCHEDULE_ITEM', payload: updated });
    expect(dispatch).toHaveBeenNthCalledWith(2, { type: 'UPDATE_SCHEDULE_ITEM', payload: item });
  });

  it('serializes overlapping updates to the same item instead of racing', async () => {
    // Simulates rapid double-clicking a checkbox: two updates fire before
    // either Firestore write resolves. Without per-item serialization, both
    // setDoc calls go out in parallel and whichever resolves last on the
    // wire wins regardless of click order - this asserts the second write
    // doesn't even start until the first one has settled.
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

    await Promise.resolve();
    await Promise.resolve();
    expect(setDocMock).toHaveBeenCalledTimes(1);

    resolveFirstWrite();
    await firstUpdate;
    await secondUpdate;

    expect(setDocMock).toHaveBeenCalledTimes(2);
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
  });
});
