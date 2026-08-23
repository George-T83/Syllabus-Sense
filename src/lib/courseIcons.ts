import type { Course } from '@/types/schedule';
import { scopeToTerm } from '@/lib/courseColors';

/**
 * A course's icon, separate from its color - color says "which course at a
 * glance across a list," icon says "what kind of subject this is" even
 * before you've learned to associate the color. Kept as a small fixed
 * preset list (like COURSE_COLOR_PRESETS) rather than free-form upload/
 * emoji, so every course row can render it as a plain stroked SVG glyph
 * instead of juggling image assets.
 */
export interface CourseIconPreset {
  value: string;
  label: string;
}

export const COURSE_ICON_PRESETS: CourseIconPreset[] = [
  { value: 'book', label: 'Reading/General' },
  { value: 'calculator', label: 'Math' },
  { value: 'flask', label: 'Science' },
  { value: 'globe', label: 'History/Geography' },
  { value: 'chat', label: 'Language' },
  { value: 'code', label: 'Computer Science' },
  { value: 'chart', label: 'Business/Economics' },
  { value: 'palette', label: 'Art/Design' },
  { value: 'music', label: 'Music' },
  { value: 'film', label: 'Media/Theater' },
  { value: 'heart', label: 'Health/Psychology' },
  { value: 'scale', label: 'Law/Political Science' },
  { value: 'bolt', label: 'Fitness/Kinesiology' },
  { value: 'puzzle', label: 'Other' },
];

export const DEFAULT_COURSE_ICON = 'book';

const ICON_VALUES = COURSE_ICON_PRESETS.map((p) => p.value);

/** Every reader of `Course.icon` goes through this rather than trusting the
 * stored string directly, so a missing/renamed/hand-edited value degrades
 * to the default glyph instead of rendering nothing. */
export function resolveCourseIcon(icon: string | undefined): string {
  return icon && ICON_VALUES.includes(icon) ? icon : DEFAULT_COURSE_ICON;
}

/** Prefers the syllabus extractor's subject-matched icon suggestion, same
 * as `pickSuggestedCourseColor`, but the avoidance here is a soft nicety
 * rather than a hard rule: two same-subject courses sharing an icon is
 * genuinely fine (color still tells them apart), so this only steers away
 * from a suggestion that's already in use by another course *this term*
 * when a less-used icon is readily available - never at the cost of
 * falling back past the default. */
export function pickSuggestedCourseIcon(
  existingCourses: Pick<Course, 'icon' | 'term'>[],
  term: string | null | undefined,
  suggested: string | null | undefined,
): string {
  const isValid = !!suggested && ICON_VALUES.includes(suggested);
  if (!isValid) return DEFAULT_COURSE_ICON;
  const pool = scopeToTerm(existingCourses, term);
  const alreadyUsed = pool.some((c) => c.icon === suggested);
  if (!alreadyUsed) return suggested;
  return pickLeastUsedIcon(pool) ?? suggested;
}

/** Least-represented preset among `existingCourses`, ties broken by preset
 * order - only called once a suggested icon is already taken this term, so
 * a genuine tie (e.g. every preset equally used) just keeps the original
 * suggestion rather than reshuffling for no benefit. */
function pickLeastUsedIcon(existingCourses: Pick<Course, 'icon'>[]): string | null {
  const counts = new Map(ICON_VALUES.map((v) => [v, 0]));
  for (const course of existingCourses) {
    if (course.icon && counts.has(course.icon)) {
      counts.set(course.icon, (counts.get(course.icon) ?? 0) + 1);
    }
  }
  let best: string | null = null;
  let bestCount = Infinity;
  for (const value of ICON_VALUES) {
    const count = counts.get(value) ?? 0;
    if (count < bestCount) {
      best = value;
      bestCount = count;
    }
  }
  return bestCount === 0 ? best : null;
}
