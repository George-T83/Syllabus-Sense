import React from 'react';
import { Skeleton, SkeletonCard } from '@/components/ui/Skeleton';

export default function CoursesLoading() {
  return (
    <div
      data-testid="courses-loading-skeleton"
      className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in"
    >
      {/* Header & Controls Shimmer */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-2">
          <Skeleton width={200} height={32} className="rounded-xl" />
          <Skeleton width={320} height={18} className="rounded-lg" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton width={140} height={44} className="rounded-xl" />
          <Skeleton width={130} height={44} className="rounded-xl" />
        </div>
      </div>

      {/* Courses Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} className="min-h-[220px]" />
        ))}
      </div>
    </div>
  );
}
