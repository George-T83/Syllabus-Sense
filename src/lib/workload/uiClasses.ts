import type { WorkloadLevel } from '@/types/schedule';

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

/** Text color, for labels that need to read as the level's color. */
export const WORKLOAD_TEXT_CLASS: Record<WorkloadLevel, string> = {
  low: 'text-load-low',
  medium: 'text-load-medium',
  high: 'text-load-high',
  critical: 'text-load-critical',
};
