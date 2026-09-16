/**
 * Reading-load estimator (Part B): turns a page count into a suggested
 * estimatedHours for a "reading" schedule item, instead of leaving the
 * student to guess. Pages-per-hour figures are standard academic-reading-
 * speed heuristics - dense technical/academic text reads far slower than
 * light narrative reading, even before factoring in note-taking.
 */

export type ReadingDensity = 'light' | 'standard' | 'dense';

export const READING_DENSITY_OPTIONS: { value: ReadingDensity; label: string; helper: string }[] = [
  { value: 'light', label: 'Light', helper: '~50 pages/hour - narrative, easy prose' },
  { value: 'standard', label: 'Standard', helper: '~25 pages/hour - typical textbook chapter' },
  {
    value: 'dense',
    label: 'Dense',
    helper: '~15 pages/hour - technical or heavily annotated text',
  },
];

const PAGES_PER_HOUR: Record<ReadingDensity, number> = {
  light: 50,
  standard: 25,
  dense: 15,
};

const MIN_HOURS = 0.25;
const ROUNDING_STEP = 0.25;

/** Estimated hours to read `pages` pages at the given density, rounded to
 * the nearest quarter hour with a quarter-hour floor - a two-page reading
 * still costs some real time to sit down and do. */
export function estimateReadingHours(pages: number, density: ReadingDensity = 'standard'): number {
  if (!Number.isFinite(pages) || pages <= 0) return 0;
  const rawHours = pages / PAGES_PER_HOUR[density];
  const rounded = Math.round(rawHours / ROUNDING_STEP) * ROUNDING_STEP;
  return Math.max(MIN_HOURS, rounded);
}
