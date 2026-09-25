'use client';

import { useId } from 'react';
import { cn } from '@/lib/utils';

export type RingGaugeLevel = 'low' | 'medium' | 'high' | 'critical';

const LEVEL_STROKE: Record<RingGaugeLevel, string> = {
  low: 'stroke-load-low',
  medium: 'stroke-load-medium',
  high: 'stroke-load-high',
  critical: 'stroke-load-critical',
};

export interface RingGaugeProps {
  /** 0-1 fraction of the ring to fill. */
  progress: number;
  /** Semantic arc color (ignored when `variant="brand"`). */
  level?: RingGaugeLevel;
  /** 'semantic' (default) colors the arc by `level`; 'brand' colors it with
   * the same gradient as the needle - for gauges with no safe/warning/
   * critical meaning (a focus timer, a plain completion ring). */
  variant?: 'semantic' | 'brand';
  size?: number;
  radius?: number;
  strokeWidth?: number;
  className?: string;
  children?: React.ReactNode;
  'aria-label'?: string;
  'aria-valuenow'?: number;
  'aria-valuemin'?: number;
  'aria-valuemax'?: number;
}

/**
 * Ring + needle gauge primitive - the same ring-and-pointer language as the
 * compass mark (Logo.tsx), reused for any 0-1 progress value instead of a
 * bare circular progress bar. The needle rotates to the current value's
 * position on the ring, echoing the logo's cardinal needle; in the default
 * "semantic" variant the ring itself stays on load-low/medium/high/critical
 * so severity reads the same as everywhere else in the app, while "brand"
 * gives the arc the same gradient as the needle for gauges with no
 * safe/warning/critical meaning.
 */
export function RingGauge({
  progress,
  level = 'low',
  variant = 'semantic',
  size = 140,
  radius,
  strokeWidth = 10,
  className,
  children,
  'aria-label': ariaLabel,
  'aria-valuenow': ariaValueNow,
  'aria-valuemin': ariaValueMin,
  'aria-valuemax': ariaValueMax,
}: RingGaugeProps) {
  const gradId = `ring-gauge-grad-${useId()}`;
  const center = size / 2;
  const r = radius ?? center - strokeWidth - 6;
  const circumference = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, progress));
  const strokeDashoffset = circumference - clamped * circumference;

  // 12 o'clock = 0, sweeping clockwise - same convention as the arc itself.
  const angleRad = clamped * 2 * Math.PI - Math.PI / 2;
  const needleLen = r * 0.72;
  const needleWidth = r * 0.16;
  const tipX = center + Math.cos(angleRad) * needleLen;
  const tipY = center + Math.sin(angleRad) * needleLen;
  const baseR = needleWidth / 2;
  const b1x = center + Math.cos(angleRad + Math.PI / 2) * baseR;
  const b1y = center + Math.sin(angleRad + Math.PI / 2) * baseR;
  const b2x = center + Math.cos(angleRad - Math.PI / 2) * baseR;
  const b2y = center + Math.sin(angleRad - Math.PI / 2) * baseR;

  return (
    <div
      className={cn('relative flex items-center justify-center', className)}
      style={{ width: size, height: size }}
      role="progressbar"
      aria-label={ariaLabel}
      aria-valuenow={ariaValueNow}
      aria-valuemin={ariaValueMin}
      aria-valuemax={ariaValueMax}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#8C6EFF" />
            <stop offset="55%" stopColor="#5B3DF5" />
            <stop offset="100%" stopColor="#00BFA0" />
          </linearGradient>
        </defs>
        <circle
          cx={center}
          cy={center}
          r={r}
          strokeWidth={strokeWidth}
          className="stroke-slate-200 dark:stroke-slate-800"
          fill="transparent"
        />
        <circle
          cx={center}
          cy={center}
          r={r}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="transparent"
          stroke={variant === 'brand' ? `url(#${gradId})` : undefined}
          className={cn(
            'transition-all duration-700 ease-out',
            variant === 'semantic' && LEVEL_STROKE[level],
          )}
        />
      </svg>
      {clamped > 0 && (
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="absolute inset-0"
        >
          <polygon
            points={`${tipX},${tipY} ${b1x},${b1y} ${b2x},${b2y}`}
            fill={`url(#${gradId})`}
          />
          <circle cx={center} cy={center} r={strokeWidth * 0.42} fill={`url(#${gradId})`} />
        </svg>
      )}
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
}
