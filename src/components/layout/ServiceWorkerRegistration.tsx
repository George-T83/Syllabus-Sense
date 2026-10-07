'use client';

import { useEffect } from 'react';

/**
 * Registers the service worker (public/sw.js) so the installed app opens
 * offline. Production only: in development it would serve stale pages and fight
 * hot reloading.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
      // Registration can fail (private mode, blocked storage); the app works without it.
    });
  }, []);
  return null;
}
