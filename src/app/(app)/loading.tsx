import React from 'react';
import { Skeleton, SkeletonCard } from '@/components/ui/Skeleton';

export default function AppRootLoading() {
  return (
    <div
      data-testid="app-root-loading-skeleton"
      className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-2">
          <Skeleton width={220} height={32} className="rounded-xl" />
          <Skeleton width={320} height={18} className="rounded-lg" />
        </div>
        <Skeleton width={120} height={44} className="rounded-xl" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </div>
  );
}
