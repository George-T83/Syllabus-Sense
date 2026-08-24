import React from 'react';
import { Skeleton } from '@/components/ui/Skeleton';

export default function CalendarLoading() {
  return (
    <div
      data-testid="calendar-loading-skeleton"
      className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in"
    >
      {/* Calendar Header & Month Navigation Shimmer */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Skeleton width={180} height={32} className="rounded-xl" />
          <div className="flex items-center gap-1">
            <Skeleton width={44} height={44} className="rounded-xl" />
            <Skeleton width={44} height={44} className="rounded-xl" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Skeleton width={100} height={44} className="rounded-xl" />
          <Skeleton width={100} height={44} className="rounded-xl" />
          <Skeleton width={120} height={44} className="rounded-xl" />
        </div>
      </div>

      {/* Weekday Header Shimmer */}
      <div className="grid grid-cols-7 gap-2 text-center">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} height={24} className="rounded-lg" />
        ))}
      </div>

      {/* 7x5 Calendar Day Cell Grid Shimmer */}
      <div className="grid grid-cols-7 gap-2">
        {Array.from({ length: 35 }).map((_, i) => (
          <div
            key={i}
            className="min-h-[100px] p-2 rounded-xl border border-border/30 bg-card/40 space-y-2 flex flex-col justify-between"
          >
            <div className="flex justify-between items-center">
              <Skeleton width={20} height={16} />
              {i % 4 === 0 && <Skeleton width={16} height={16} variant="circular" />}
            </div>
            {i % 3 === 0 && (
              <div className="space-y-1">
                <Skeleton height={16} className="w-full rounded-md" />
                {i % 6 === 0 && <Skeleton height={16} className="w-4/5 rounded-md" />}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
