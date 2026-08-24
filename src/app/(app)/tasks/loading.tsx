import React from 'react';
import { Skeleton } from '@/components/ui/Skeleton';

export default function TasksLoading() {
  return (
    <div
      data-testid="tasks-loading-skeleton"
      className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in"
    >
      {/* Header & View Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-2">
          <Skeleton width={220} height={32} className="rounded-xl" />
          <Skeleton width={300} height={18} className="rounded-lg" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton width={180} height={44} className="rounded-xl" />
          <Skeleton width={120} height={44} className="rounded-xl" />
        </div>
      </div>

      {/* Filter and Search Bar Shimmer */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <Skeleton width="100%" height={44} className="max-w-md rounded-xl" />
        <div className="flex items-center gap-2">
          <Skeleton width={110} height={44} className="rounded-xl" />
          <Skeleton width={110} height={44} className="rounded-xl" />
        </div>
      </div>

      {/* Stacked Task Rows Shimmer */}
      <div className="space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center justify-between gap-4 p-4 rounded-2xl border border-border/40 bg-card/60 shadow-sm"
          >
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <Skeleton variant="circular" width={22} height={22} className="shrink-0" />
              <div className="space-y-1.5 flex-1 min-w-0">
                <Skeleton width="60%" height={18} />
                <div className="flex items-center gap-2">
                  <Skeleton width={80} height={12} />
                  <Skeleton width={60} height={12} />
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <Skeleton width={70} height={24} variant="rounded" />
              <Skeleton width={80} height={16} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
