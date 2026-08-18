import { ICON_PATHS, type IconKey } from '@/lib/icons';
import { cn } from '@/lib/utils';

export interface SectionIconProps {
  icon: IconKey;
  className?: string;
}

/** Small colored icon badge anchoring a section heading - the same visual
 * language used across Dashboard/Calendar/Planner instead of a bare text
 * heading. */
export function SectionIcon({ icon, className }: SectionIconProps) {
  return (
    <span
      className={cn(
        'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary',
        className,
      )}
    >
      <svg
        className="h-4 w-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d={ICON_PATHS[icon]} />
      </svg>
    </span>
  );
}
