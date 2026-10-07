'use client';

import React, { useState } from 'react';
import { CardActionButton } from '@/components/ui/CardAction';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { cn } from '@/lib/utils';

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
        className={cn(
          'flex items-center gap-3 rounded-xl border border-load-low/30 bg-load-low/10 px-4 py-3 text-sm text-foreground',
          className,
        )}
      >
        <svg
          className="h-4 w-4 shrink-0 text-load-low"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
        </svg>
        <span>
          <strong>Connection restored!</strong> Syncing your syllabus, tasks, and schedule...
        </span>
      </div>
    );
  }

  // State B: Offline Warning Banner
  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="offline-network-banner"
      className={cn(
        'flex flex-col gap-3 rounded-xl border border-load-medium/30 bg-load-medium/10 px-4 py-3 text-sm text-foreground sm:flex-row sm:items-center sm:justify-between',
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <svg
          className="mt-0.5 h-4 w-4 shrink-0 text-load-medium"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 4.243a9 9 0 01-12.728-12.728m12.728 12.728L3 3m5.636 12.728a5 5 0 01-7.072-7.072"
          />
        </svg>
        <div>
          <span className="font-semibold">Offline Mode:</span> You are currently offline. What you
          change is kept on this device and will sync once reconnected.
        </div>
      </div>

      <CardActionButton
        onClick={handleManualCheck}
        disabled={checking}
        data-testid="retry-connection-button"
        className="self-start sm:self-auto"
      >
        {checking ? 'Checking...' : 'Check Connection'}
      </CardActionButton>
    </div>
  );
}

export default OfflineBanner;
