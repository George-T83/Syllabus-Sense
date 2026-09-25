import { useId } from 'react';
import { ICON_PATHS, type IconKey } from '@/lib/icons';
import { cn } from '@/lib/utils';

export interface SectionIconProps {
  icon: IconKey;
  className?: string;
}

/** Small icon badge anchoring a section heading - the same visual language
 * used across Dashboard/Calendar/Planner instead of a bare text heading.
 * The glyph's stroke is the same brand gradient as the compass mark/navbar/
 * sidebar (one icon language, not a flat single-color tint), on a softly
 * gradient-tinted badge rather than the old flat bg-primary/10. */
export function SectionIcon({ icon, className }: SectionIconProps) {
  const gradId = `section-icon-grad-${useId()}`;
  return (
    <span
      className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-lg', className)}
      style={{
        backgroundImage:
          'linear-gradient(135deg, rgba(140,110,255,0.12), rgba(91,61,245,0.12) 55%, rgba(0,191,160,0.12))',
      }}
    >
      <svg
        className="h-4 w-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke={`url(#${gradId})`}
        strokeWidth={1.8}
      >
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#8C6EFF" />
            <stop offset="55%" stopColor="#5B3DF5" />
            <stop offset="100%" stopColor="#00BFA0" />
          </linearGradient>
        </defs>
        <path strokeLinecap="round" strokeLinejoin="round" d={ICON_PATHS[icon]} />
      </svg>
    </span>
  );
}
