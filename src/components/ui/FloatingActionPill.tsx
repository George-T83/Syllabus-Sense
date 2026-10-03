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
  /** Adds a small close button that hides the pill. The caller owns where
   * that choice is stored and how the pill comes back. */
  onDismiss?: () => void;
  /** Accessible name for the close button, e.g. "Hide the AI Advisor button". */
  dismissLabel?: string;
}

/** The floating pill-shaped trigger pattern shared by the AI Advisor and
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
  onDismiss,
  dismissLabel,
}: FloatingActionPillProps) {
  return (
    <div className={cn('fixed', positionClassName)}>
      <button
        onClick={onClick}
        aria-label={ariaLabel}
        title={title}
        className={cn(
          'flex items-center gap-2.5 rounded-full border px-4 py-2.5 text-xs font-semibold text-white backdrop-blur-md transition-all duration-300 hover:scale-105 active:scale-95 focus:outline-none focus:ring-2',
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
              'hidden rounded-full bg-white/20 px-2 py-0.5 text-xs font-mono text-white/90 sm:inline-block',
              shortcutClassName,
            )}
          >
            {shortcut}
          </span>
        )}
      </button>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label={dismissLabel ?? 'Hide this button'}
          title={dismissLabel ?? 'Hide this button'}
          className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <svg
            className="h-3 w-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}
