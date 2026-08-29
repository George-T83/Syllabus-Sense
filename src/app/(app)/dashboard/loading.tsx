import { Skeleton, SkeletonCard } from '@/components/ui/Skeleton';

export default function DashboardLoading() {
  return (
    <div
      data-testid="dashboard-loading-skeleton"
      className="space-y-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in"
    >
      {/* Hero Greeting Shimmer */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-2">
          <Skeleton width={260} height={32} className="rounded-xl" />
          <Skeleton width={380} height={18} className="rounded-lg" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton width={140} height={44} className="rounded-xl" />
          <Skeleton width={110} height={44} className="rounded-xl" />
        </div>
      </div>

      {/* Cognitive Workload & Stat Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="rounded-2xl border border-border/40 bg-card/60 p-6 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <Skeleton width={140} height={20} />
            <Skeleton variant="circular" width={32} height={32} />
          </div>
          <div className="flex items-baseline gap-3">
            <Skeleton width={80} height={36} />
            <Skeleton width={100} height={16} />
          </div>
          <Skeleton width="100%" height={8} className="rounded-full" />
        </div>

        <div className="rounded-2xl border border-border/40 bg-card/60 p-6 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <Skeleton width={130} height={20} />
            <Skeleton variant="circular" width={32} height={32} />
          </div>
          <div className="flex items-baseline gap-3">
            <Skeleton width={60} height={36} />
            <Skeleton width={90} height={16} />
          </div>
          <Skeleton width="100%" height={8} className="rounded-full" />
        </div>

        <div className="rounded-2xl border border-border/40 bg-card/60 p-6 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <Skeleton width={150} height={20} />
            <Skeleton variant="circular" width={32} height={32} />
          </div>
          <div className="flex items-baseline gap-3">
            <Skeleton width={70} height={36} />
            <Skeleton width={110} height={16} />
          </div>
          <Skeleton width="100%" height={8} className="rounded-full" />
        </div>
      </div>

      {/* Main Two Column Layout: Enrolled Courses & Today's Runway */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 Cols: Enrolled Courses */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <Skeleton width={180} height={24} />
            <Skeleton width={80} height={16} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        </div>

        {/* Right 1 Col: Upcoming Runway Tasks */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Skeleton width={160} height={24} />
            <Skeleton width={70} height={16} />
          </div>
          <div className="rounded-2xl border border-border/40 bg-card/60 p-5 space-y-3 shadow-sm">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center justify-between gap-3 p-3 rounded-xl bg-background/50 border border-border/20"
              >
                <div className="flex items-center gap-3">
                  <Skeleton variant="circular" width={20} height={20} />
                  <div className="space-y-1.5">
                    <Skeleton width={140} height={16} />
                    <Skeleton width={80} height={12} />
                  </div>
                </div>
                <Skeleton width={50} height={20} variant="rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
