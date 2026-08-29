'use client';

import React, { useState } from 'react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

export interface OfflineBannerProps {
  className?: string;
  reconnectNoticeDurationMs?: number;
}

export function OfflineBanner({
  className = '',
  reconnectNoticeDurationMs = 4000,
}: OfflineBannerProps) {
  const { isOnline, wasOffline, checkConnection } = useOnlineStatus(reconnectNoticeDurationMs);
  const [checking, setChecking] = useState(false);

  const handleManualCheck = async () => {
    setChecking(true);
    await checkConnection();
    setChecking(false);
  };

  // If online and not in the "recently reconnected" sync notice state, render nothing
  if (isOnline && !wasOffline) {
    return null;
  }

  // State A: Reconnection / Sync Notice
  if (isOnline && wasOffline) {
    return (
      <div
        role="status"
        aria-live="polite"
        data-testid="online-sync-banner"
        className={`w-full bg-emerald-600/90 dark:bg-emerald-700/90 text-white backdrop-blur-md px-4 py-2 text-xs sm:text-sm font-medium transition-all duration-300 shadow-md ${className}`}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <svg
              className="w-4 h-4 shrink-0 text-emerald-200"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M5 13l4 4L19 7"
              />
            </svg>
            <span>
              <strong>Connection restored!</strong> Syncing your syllabus, tasks, and schedule...
            </span>
          </div>
          <span className="hidden sm:inline text-emerald-200 text-xs">Live Cloud Sync</span>
        </div>
      </div>
    );
  }

  // State B: Offline Warning Banner
  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="offline-network-banner"
      className={`w-full bg-amber-500/95 dark:bg-amber-600/95 text-amber-950 dark:text-amber-50 backdrop-blur-md px-4 py-2.5 text-xs sm:text-sm font-medium transition-all duration-300 shadow-md border-b border-amber-600/20 ${className}`}
    >
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5">
          <svg
            className="w-4 h-4 shrink-0 text-amber-900 dark:text-amber-200"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 4.243a9 9 0 01-12.728-12.728m12.728 12.728L3 3m5.636 12.728a5 5 0 01-7.072-7.072"
            />
          </svg>
          <div>
            <span className="font-bold">Offline Mode:</span> You are currently offline. Changes are saved locally and will sync once reconnected.
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleManualCheck}
            disabled={checking}
            data-testid="retry-connection-button"
            className="px-3 py-1 bg-amber-900/15 dark:bg-black/25 hover:bg-amber-900/25 dark:hover:bg-black/40 text-amber-950 dark:text-amber-100 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 min-h-[32px] cursor-pointer"
          >
            {checking ? 'Checking...' : 'Check Connection'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default OfflineBanner;
