'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface FloatingActionPillProps {
  onClick: () => void;
  ariaLabel: string;
  title?: string;
  /** The button's own fixed position + stacking (e.g.
   * "bottom-20 right-5 z-40 md:bottom-6 md:right-6") - each instance keeps
   * its own exact placement rather than assuming a shared symmetric layout,
   * since the app's existing pills don't actually mirror each other. */
  positionClassName: string;
  /** Border/gradient/shadow/focus-ring treatment, e.g.
   * "border-amber-400/30 bg-gradient-to-r from-amber-500 via-amber-600
   * to-orange-600 shadow-[...] hover:shadow-[...] focus:ring-amber-400". */
  colorClassName: string;
  icon: ReactNode;
  label: string;
  labelClassName?: string;
  shortcut?: string;
  shortcutClassName?: string;
  /** The pulsing "live" dot every current instance shows. */
  showActiveDot?: boolean;
}

/** The floating pill-shaped trigger pattern shared by the AI Copilot and
 * Focus Timer buttons - previously two near-identical hand-copied buttons
 * differing only in color, position, icon, and label. */
export function FloatingActionPill({
  onClick,
  ariaLabel,
  title,
  positionClassName,
  colorClassName,
  icon,
  label,
  labelClassName,
  shortcut,
  shortcutClassName,
  showActiveDot = true,
}: FloatingActionPillProps) {
  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel}
      title={title}
      className={cn(
        'fixed flex items-center gap-2.5 rounded-full border px-4 py-2.5 text-xs font-semibold text-white backdrop-blur-md transition-all duration-300 hover:scale-105 active:scale-95 focus:outline-none focus:ring-2',
        positionClassName,
        colorClassName,
      )}
    >
      {showActiveDot && (
        <div className="relative flex h-2 w-2 items-center justify-center">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
        </div>
      )}
      {icon}
      <span className={cn('font-bold tracking-wide', labelClassName)}>{label}</span>
      {shortcut && (
        <span
          className={cn(
            'hidden rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-mono text-white/90 sm:inline-block',
            shortcutClassName,
          )}
        >
          {shortcut}
        </span>
      )}
    </button>
  );
}
