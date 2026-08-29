import React from 'react';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'rectangular' | 'circular' | 'rounded' | 'text';
  width?: string | number;
  height?: string | number;
  shimmer?: boolean;
}

export function Skeleton({
  variant = 'rounded',
  width,
  height,
  shimmer = true,
  className = '',
  style,
  ...props
}: SkeletonProps) {
  const variantStyles = {
    rectangular: 'rounded-none',
    circular: 'rounded-full',
    rounded: 'rounded-xl',
    text: 'rounded-md h-4',
  }[variant];

  const inlineStyles: React.CSSProperties = {
    width: typeof width === 'number' ? `${width}px` : width,
    height: typeof height === 'number' ? `${height}px` : height,
    ...style,
  };

  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      className={`bg-muted/40 ${shimmer ? 'animate-pulse' : ''} ${variantStyles} ${className}`}
      style={inlineStyles}
      {...props}
    >
      <span className="sr-only">Loading...</span>
    </div>
  );
}

export function SkeletonText({
  lines = 3,
  className = '',
  lineHeight = 16,
  gap = 8,
}: {
  lines?: number;
  className?: string;
  lineHeight?: number;
  gap?: number;
}) {
  return (
    <div
      role="status"
      aria-busy="true"
      className={`flex flex-col ${className}`}
      style={{ gap: `${gap}px` }}
    >
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          variant="text"
          height={lineHeight}
          className={index === lines - 1 && lines > 1 ? 'w-3/4' : 'w-full'}
        />
      ))}
    </div>
  );
}

export function SkeletonCard({
  className = '',
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      role="status"
      aria-busy="true"
      className={`rounded-2xl border border-border/40 bg-card/60 p-5 shadow-sm space-y-4 ${className}`}
    >
      {children || (
        <>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Skeleton variant="circular" width={40} height={40} />
              <div className="space-y-1.5">
                <Skeleton width={120} height={18} />
                <Skeleton width={80} height={14} />
              </div>
            </div>
            <Skeleton width={60} height={24} variant="rounded" />
          </div>
          <SkeletonText lines={2} />
          <div className="flex items-center justify-between pt-2 border-t border-border/20">
            <Skeleton width={90} height={16} />
            <Skeleton width={70} height={28} variant="rounded" />
          </div>
        </>
      )}
    </div>
  );
}

export function SkeletonButton({
  width = 100,
  height = 40,
  className = '',
}: {
  width?: number | string;
  height?: number | string;
  className?: string;
}) {
  return (
    <Skeleton
      variant="rounded"
      width={width}
      height={height}
      className={`min-h-[44px] ${className}`}
    />
  );
}

export default Skeleton;
