import { clearIndexedDbPersistence, terminate } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';

/** Name prefix of every cache the service worker (public/sw.js) creates. */
const SW_CACHE_PREFIX = 'ss-';

/**
 * Removes what the app keeps on this device for offline use: the cached copy
 * of the signed-in student's data and the saved pages. Called on sign-out and
 * after account deletion, so the next person on a shared computer finds none
 * of it.
 *
 * Firestore can only clear its local copy once it has shut down, so after a
 * successful clear the page reloads at the sign-in screen with a fresh
 * connection. Returns false (and does nothing) where there is no local copy.
 */
export async function clearOfflineData(): Promise<boolean> {
  if (typeof window === 'undefined' || !('indexedDB' in window) || !db) return false;
  try {
    await terminate(db);
    await clearIndexedDbPersistence(db);
  } catch {
    // Nothing to clear, or another open tab holds it: carry on to the reload.
  }
  try {
    if ('caches' in window) {
      const names = await caches.keys();
      await Promise.all(
        names.filter((n) => n.startsWith(SW_CACHE_PREFIX)).map((n) => caches.delete(n)),
      );
    }
  } catch {
    // Cache storage can be unavailable; the Firestore copy was the sensitive part.
  }
  window.location.assign('/login');
  return true;
}
