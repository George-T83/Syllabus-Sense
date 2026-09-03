import type { MoodValue } from '@/types/mood';

export interface MoodOption {
  value: MoodValue;
  emoji: string;
  label: string;
}

/** Same left-to-right order as the check-in row: worst to best. */
export const MOOD_OPTIONS: MoodOption[] = [
  { value: 1, emoji: '😫', label: 'Rough' },
  { value: 2, emoji: '😐', label: 'Okay' },
  { value: 3, emoji: '🙂', label: 'Good' },
  { value: 4, emoji: '😄', label: 'Great' },
];

export function getMoodOption(mood: MoodValue): MoodOption {
  return MOOD_OPTIONS[mood - 1];
}

/**
 * Mood shares the exact same 4-step color language as WorkloadLevel
 * (low/medium/high/critical), deliberately inverted end-for-end: a great
 * day (mood 4) gets the "low load" green, a rough day (mood 1) gets the
 * "critical load" red. That's what makes the mood-vs-workload correlation
 * chart legible at a glance - if heavy (red) workload days trend toward
 * red mood bars too, the colors themselves show the correlation before you
 * even read a number.
 */
export const MOOD_SWATCH_CLASS: Record<MoodValue, string> = {
  1: 'bg-load-critical',
  2: 'bg-load-high',
  3: 'bg-load-medium',
  4: 'bg-load-low',
};

export const MOOD_TEXT_CLASS: Record<MoodValue, string> = {
  1: 'text-load-critical',
  2: 'text-load-high',
  3: 'text-load-medium',
  4: 'text-load-low',
};

export const MOOD_CHIP_CLASS: Record<MoodValue, string> = {
  1: 'border-load-critical/30 bg-load-critical/10',
  2: 'border-load-high/30 bg-load-high/10',
  3: 'border-load-medium/30 bg-load-medium/10',
  4: 'border-load-low/30 bg-load-low/10',
};
