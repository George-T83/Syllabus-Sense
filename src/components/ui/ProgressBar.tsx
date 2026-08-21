import { cn } from '@/lib/utils';

export interface ProgressBarProps {
  /** 0-100 */
  percent: number;
  className?: string;
  /** Fill color. Defaults to the brand primary; callers pass a course hex
   * so the bar reads as "this task's" progress rather than a generic one. */
  color?: string;
}

/** Thin linear progress indicator for list rows, where a ProgressRing would
 * be too heavy. Track uses the same muted surface as the rest of the row
 * chrome; fill defaults to primary but accepts a course color so it can
 * double as a quiet course cue in dense lists. */
export function ProgressBar({ percent, className, color }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, percent));
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn('h-1 w-full overflow-hidden rounded-full bg-muted', className)}
    >
      <div
        className="h-full rounded-full transition-[width] duration-300 ease-out"
        style={{ width: `${clamped}%`, backgroundColor: color ?? 'hsl(var(--primary))' }}
      />
    </div>
  );
}
