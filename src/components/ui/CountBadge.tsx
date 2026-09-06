export interface CountBadgeProps {
  count: number;
  /** Counts above this render as "`max`+" instead of the exact number. */
  max?: number;
  className?: string;
}

/** Small circular count indicator, e.g. the Navbar bell's overdue count. */
export function CountBadge({ count, max = 9, className = '' }: CountBadgeProps) {
  return (
    <span
      className={`flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-destructive-foreground ${className}`.trim()}
      aria-hidden="true"
    >
      {count > max ? `${max}+` : count}
    </span>
  );
}
