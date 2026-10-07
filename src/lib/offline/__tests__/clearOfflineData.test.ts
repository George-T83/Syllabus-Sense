import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const terminate = vi.fn().mockResolvedValue(undefined);
const clearIndexedDbPersistence = vi.fn().mockResolvedValue(undefined);

vi.mock('firebase/firestore', () => ({
  terminate: (...a: unknown[]) => terminate(...a),
  clearIndexedDbPersistence: (...a: unknown[]) => clearIndexedDbPersistence(...a),
}));
vi.mock('@/lib/firebase/client', () => ({ db: { fake: true } }));

import { clearOfflineData } from '../clearOfflineData';

const assign = vi.fn();
const deleted: string[] = [];

beforeEach(() => {
  vi.clearAllMocks();
  deleted.length = 0;
  Object.defineProperty(window, 'indexedDB', { value: {}, configurable: true });
  Object.defineProperty(window, 'caches', {
    configurable: true,
    value: {
      keys: async () => ['ss-pages-v1', 'ss-assets-v1', 'someone-elses'],
      delete: async (n: string) => void deleted.push(n),
    },
  });
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...window.location, assign },
  });
});

afterEach(() => {
  // @ts-expect-error cleaning up the test doubles
  delete window.indexedDB;
  // @ts-expect-error cleaning up the test doubles
  delete window.caches;
});

describe('clearOfflineData', () => {
  it('shuts Firestore down, clears its local copy, drops our caches and reloads at sign-in', async () => {
    expect(await clearOfflineData()).toBe(true);
    expect(terminate).toHaveBeenCalledWith({ fake: true });
    expect(clearIndexedDbPersistence).toHaveBeenCalledWith({ fake: true });
    expect(terminate.mock.invocationCallOrder[0]).toBeLessThan(
      clearIndexedDbPersistence.mock.invocationCallOrder[0],
    );
    expect(deleted).toEqual(['ss-pages-v1', 'ss-assets-v1']);
    expect(assign).toHaveBeenCalledWith('/login');
  });

  it('still reloads when the local copy cannot be cleared', async () => {
    clearIndexedDbPersistence.mockRejectedValueOnce(new Error('held by another tab'));
    expect(await clearOfflineData()).toBe(true);
    expect(assign).toHaveBeenCalledWith('/login');
  });

  it('does nothing where there is no IndexedDB', async () => {
    // @ts-expect-error removing the double for this case
    delete window.indexedDB;
    expect(await clearOfflineData()).toBe(false);
    expect(terminate).not.toHaveBeenCalled();
    expect(assign).not.toHaveBeenCalled();
  });
});
