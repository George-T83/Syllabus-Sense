import type { WorkloadLevel } from '@/types/schedule';
import { getWorkloadLevelLabel } from './constants';

/**
 * Shared Tailwind class tokens for rendering a WorkloadLevel, so every
 * consumer (Calendar, Planner, ...) draws from the same palette instead of
 * each page defining its own slightly-different mapping.
 */

/** Solid color, for small dot/swatch indicators. */
export const WORKLOAD_SWATCH_CLASS: Record<WorkloadLevel, string> = {
  low: 'bg-load-low',
  medium: 'bg-load-medium',
  high: 'bg-load-high',
  critical: 'bg-load-critical',
};

/** Very low-opacity background, for tinting a whole cell/region. */
export const WORKLOAD_TINT_CLASS: Record<WorkloadLevel, string> = {
  low: '',
  medium: 'bg-load-medium/10',
  high: 'bg-load-high/10',
  critical: 'bg-load-critical/15',
};

/** Tinted pill/chip background + border, for badges and legend entries. */
export const WORKLOAD_CHIP_CLASS: Record<WorkloadLevel, string> = {
  low: 'border-load-low/30 bg-load-low/10',
  medium: 'border-load-medium/30 bg-load-medium/10',
  high: 'border-load-high/30 bg-load-high/10',
  critical: 'border-load-critical/30 bg-load-critical/10',
};

/**
 * Quiet "prep window" indicator (CA-1): a thin colored underline, deliberately
 * lighter-weight than WORKLOAD_TINT_CLASS's full-cell background wash. Use
 * this for a day that only carries spread-out prep-time load (from an item
 * due on a *different* day) so it reads as "lighter signal, not the real
 * thing" next to a day something is actually due/scheduled on. Never apply
 * both classes to the same cell - they're meant to be mutually exclusive
 * ("due here" vs "prep window only"), not stacked.
 */
export const WORKLOAD_PREP_INDICATOR_CLASS: Record<WorkloadLevel, string> = {
  low: '',
  medium: 'border-b-2 border-load-medium/50',
  high: 'border-b-2 border-load-high/60',
  critical: 'border-b-2 border-load-critical/70',
};

/** Text color, for labels that need to read as the level's color. */
export const WORKLOAD_TEXT_CLASS: Record<WorkloadLevel, string> = {
  low: 'text-load-low',
  medium: 'text-load-medium',
  high: 'text-load-high',
  critical: 'text-load-critical',
};

/** Complete pill badge class combining border, background tint, text color, and layout tokens. */
export const WORKLOAD_BADGE_CLASS: Record<WorkloadLevel, string> = {
  low: 'border border-load-low/30 bg-load-low/10 text-load-low',
  medium: 'border border-load-medium/30 bg-load-medium/10 text-load-medium',
  high: 'border border-load-high/30 bg-load-high/10 text-load-high',
  critical: 'border border-load-critical/30 bg-load-critical/10 text-load-critical',
};

/** High-contrast solid badge class for alert banners and prominent hero callouts. */
export const WORKLOAD_SOLID_BADGE_CLASS: Record<WorkloadLevel, string> = {
  low: 'bg-load-low text-white border-transparent',
  medium: 'bg-load-medium text-white border-transparent',
  high: 'bg-load-high text-white border-transparent',
  critical: 'bg-load-critical text-white border-transparent',
};

/**
 * Card border + ambient glow that escalates with real severity (globals.css
 * defines the actual .glow-edge* rules) - 'low' stays the calm, static
 * brand-gradient look used everywhere else a card just needs to look
 * "important" (Card.tsx's accent="glow"); medium/high/critical progress
 * through amber -> orange -> red and start breathing, so a genuinely
 * urgent day is louder than a merely busy one instead of every non-quiet
 * day getting the same fixed "urgent" treatment.
 */
export const WORKLOAD_GLOW_CLASS: Record<WorkloadLevel, string> = {
  low: 'glow-edge glow-edge-low',
  medium: 'glow-edge glow-edge-medium glow-edge-pulse',
  high: 'glow-edge glow-edge-high glow-edge-pulse',
  critical: 'glow-edge glow-edge-critical glow-edge-pulse',
};

/**
 * Unified badge helper returning consistent tokens across dashboard, planner, calendar, and task views.
 */
export function getWorkloadBadgeTokens(
  level: WorkloadLevel,
  options: { solid?: boolean; labelVariant?: 'extreme' | 'critical' } = {},
): {
  level: WorkloadLevel;
  label: string;
  badgeClass: string;
  swatchClass: string;
  tintClass: string;
  textClass: string;
  chipClass: string;
} {
  const label = getWorkloadLevelLabel(level, options.labelVariant);
  const badgeClass = options.solid
    ? WORKLOAD_SOLID_BADGE_CLASS[level]
    : WORKLOAD_BADGE_CLASS[level];
  return {
    level,
    label,
    badgeClass,
    swatchClass: WORKLOAD_SWATCH_CLASS[level],
    tintClass: WORKLOAD_TINT_CLASS[level],
    textClass: WORKLOAD_TEXT_CLASS[level],
    chipClass: WORKLOAD_CHIP_CLASS[level],
  };
}
