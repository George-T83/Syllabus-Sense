'use client';

import { useState, useEffect, useCallback } from 'react';

export interface OnlineStatus {
  isOnline: boolean;
  wasOffline: boolean;
  lastOnlineAt: Date | null;
  reconnectCount: number;
  checkConnection: () => Promise<boolean>;
}

export function useOnlineStatus(reconnectNoticeDurationMs: number = 4000): OnlineStatus {
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    if (typeof navigator !== 'undefined') {
      return navigator.onLine;
    }
    return true;
  });

  const [wasOffline, setWasOffline] = useState<boolean>(false);
  const [lastOnlineAt, setLastOnlineAt] = useState<Date | null>(() => (isOnline ? new Date() : null));
  const [reconnectCount, setReconnectCount] = useState<number>(0);

  const checkConnection = useCallback(async (): Promise<boolean> => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setIsOnline(false);
      return false;
    }

    try {
      // Light ping to favicon or current origin
      const response = await fetch('/manifest.webmanifest', {
        method: 'HEAD',
        cache: 'no-store',
      });
      const online = response.ok;
      setIsOnline(online);
      if (online) {
        setLastOnlineAt(new Date());
      }
      return online;
    } catch {
      // If network request failed, treat as offline
      setIsOnline(false);
      return false;
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let timeoutId: NodeJS.Timeout | null = null;

    const handleOnline = () => {
      setIsOnline(true);
      setWasOffline(true);
      setLastOnlineAt(new Date());
      setReconnectCount((prev) => prev + 1);

      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setWasOffline(false);
      }, reconnectNoticeDurationMs);
    };

    const handleOffline = () => {
      setIsOnline(false);
      if (timeoutId) clearTimeout(timeoutId);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [reconnectNoticeDurationMs]);

  return {
    isOnline,
    wasOffline,
    lastOnlineAt,
    reconnectCount,
    checkConnection,
  };
}

export default useOnlineStatus;
