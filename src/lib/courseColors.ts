import type { CSSProperties } from 'react';
import type { Course } from '@/types/schedule';

/**
 * A course's color is either one of these curated Tailwind presets (stored
 * as the literal class name, e.g. "bg-blue-500") or a user-picked custom
 * hex string (e.g. "#7c3aed"). Presets stay Tailwind classes rather than
 * hex so existing usages that just do `className={course.color}` keep
 * working unchanged; custom colors are the escape hatch for when 14 presets
 * still isn't enough to keep every course visually distinct.
 */
export interface CoursePreset {
  /** Tailwind class name, also the value stored on Course.color. */
  value: string;
  /** Approximate hex of the same swatch, used only for the tint math below -
   * Tailwind's own JIT output is what actually renders the solid color. */
  hex: string;
}

export const COURSE_COLOR_PRESETS: CoursePreset[] = [
  { value: 'bg-blue-500', hex: '#3b82f6' },
  { value: 'bg-green-500', hex: '#22c55e' },
  { value: 'bg-purple-500', hex: '#a855f7' },
  { value: 'bg-red-500', hex: '#ef4444' },
  { value: 'bg-orange-500', hex: '#f97316' },
  { value: 'bg-teal-500', hex: '#14b8a6' },
  { value: 'bg-pink-500', hex: '#ec4899' },
  { value: 'bg-indigo-500', hex: '#6366f1' },
  { value: 'bg-amber-500', hex: '#f59e0b' },
  { value: 'bg-cyan-500', hex: '#06b6d4' },
  { value: 'bg-rose-500', hex: '#f43f5e' },
  { value: 'bg-lime-500', hex: '#84cc16' },
  { value: 'bg-violet-500', hex: '#8b5cf6' },
  { value: 'bg-emerald-500', hex: '#10b981' },
];

/** Back-compat alias - the old 6-entry list some components imported by
 * this name. Kept as the first 6 presets so previously-saved courses using
 * these exact classes keep resolving the same swatch. */
export const COURSE_COLORS = COURSE_COLOR_PRESETS.slice(0, 6).map((p) => p.value);

/** Static literal Tailwind classes (not built from a template string) so
 * Tailwind's content scanner can see them verbatim in source - a
 * runtime-concatenated `${color}/15` would never make it into the
 * generated CSS. */
export const COURSE_CHIP_TINT_CLASS: Record<string, string> = {
  'bg-blue-500': 'bg-blue-500/15 border-blue-500/30 text-blue-700 dark:text-blue-400',
  'bg-green-500': 'bg-green-500/15 border-green-500/30 text-green-700 dark:text-green-400',
  'bg-purple-500': 'bg-purple-500/15 border-purple-500/30 text-purple-700 dark:text-purple-400',
  'bg-red-500': 'bg-red-500/15 border-red-500/30 text-red-700 dark:text-red-400',
  'bg-orange-500': 'bg-orange-500/15 border-orange-500/30 text-orange-700 dark:text-orange-400',
  'bg-teal-500': 'bg-teal-500/15 border-teal-500/30 text-teal-700 dark:text-teal-400',
  'bg-pink-500': 'bg-pink-500/15 border-pink-500/30 text-pink-700 dark:text-pink-400',
  'bg-indigo-500': 'bg-indigo-500/15 border-indigo-500/30 text-indigo-700 dark:text-indigo-400',
  'bg-amber-500': 'bg-amber-500/15 border-amber-500/30 text-amber-700 dark:text-amber-400',
  'bg-cyan-500': 'bg-cyan-500/15 border-cyan-500/30 text-cyan-700 dark:text-cyan-400',
  'bg-rose-500': 'bg-rose-500/15 border-rose-500/30 text-rose-700 dark:text-rose-400',
  'bg-lime-500': 'bg-lime-500/15 border-lime-500/30 text-lime-700 dark:text-lime-400',
  'bg-violet-500': 'bg-violet-500/15 border-violet-500/30 text-violet-700 dark:text-violet-400',
  'bg-emerald-500':
    'bg-emerald-500/15 border-emerald-500/30 text-emerald-700 dark:text-emerald-400',
};

const DEFAULT_CHIP_TINT = 'bg-primary/10 border-primary/25 text-primary';

function isCustomColor(color: string | undefined): color is string {
  return !!color && color.startsWith('#');
}

/** For a solid swatch (dot, avatar badge, bar fill, day-chip background):
 * a Tailwind class for presets, or an inline style for a custom hex. */
export function courseSwatch(color: string | undefined): {
  className: string;
  style?: CSSProperties;
} {
  if (isCustomColor(color)) return { className: '', style: { backgroundColor: color } };
  return { className: color || 'bg-primary' };
}

/** For a tinted chip/pill background matching a course's color, at legend
 * or filter-chip weight. */
export function courseChipTint(color: string | undefined): {
  className: string;
  style?: CSSProperties;
} {
  if (isCustomColor(color)) {
    return {
      className: '',
      style: {
        backgroundColor: `${color}26`, // ~15% alpha
        borderColor: `${color}4d`, // ~30% alpha
        color,
      },
    };
  }
  return {
    className: color ? (COURSE_CHIP_TINT_CLASS[color] ?? DEFAULT_CHIP_TINT) : DEFAULT_CHIP_TINT,
  };
}

/** @deprecated use courseChipTint - kept temporarily for call sites not yet migrated. */
export function getCourseChipTintClass(color: string | undefined): string {
  return courseChipTint(color).className || DEFAULT_CHIP_TINT;
}

/** Resolves any stored course color (a `bg-*` preset class or a custom hex
 * string) down to a literal hex value - the common step behind both
 * `courseWash` and `courseBorderColor`, since neither can express "this
 * preset's color" as a static Tailwind class name (the class needed depends
 * on runtime data, which Tailwind's static analysis can't see). */
function resolveCourseHex(color: string | undefined): string {
  return isCustomColor(color)
    ? color
    : (COURSE_COLOR_PRESETS.find((p) => p.value === color)?.hex ?? '#7c3aed');
}

/** A faint full-surface background wash (course cards, list rows) - subtler
 * than `courseChipTint` (no border, no text-color override, low alpha) so it
 * layers under normal-contrast foreground text instead of competing with it.
 * Always inline (rather than a static Tailwind class) since it needs to
 * resolve a hex value for presets too, not just custom colors. */
export function courseWash(color: string | undefined, alphaHex = '12'): CSSProperties {
  return { backgroundColor: `${resolveCourseHex(color)}${alphaHex}` };
}

/** A solid course-colored left border (task/event rows) - same hex
 * resolution as `courseWash`, full opacity, for a strong "which class is
 * this" edge instead of a small icon badge. */
export function courseBorderColor(color: string | undefined): CSSProperties {
  return { borderLeftColor: resolveCourseHex(color) };
}

/**
 * Picks the color least represented among a user's existing courses (ties
 * broken by preset order), so a freshly autofilled or manually added course
 * doesn't default to the same blue every other course starts as. Custom
 * hex colors count toward "used" but never get reassigned automatically.
 */
/** Prefers a subject-matched color suggested by the syllabus extractor
 * (see `suggestedColor` in types/extraction.ts), but falls back to
 * `pickNextCourseColor`'s least-used-preset logic when the suggestion is
 * missing, not a recognized preset, or would collide with a color an
 * existing course already uses - two courses in the same subject
 * shouldn't render identically just because they share a convention. */
export function pickSuggestedCourseColor(
  existingCourses: Pick<Course, 'color'>[],
  suggested: string | null | undefined,
): string {
  const isValidPreset = !!suggested && COURSE_COLOR_PRESETS.some((p) => p.value === suggested);
  const alreadyUsed = isValidPreset && existingCourses.some((c) => c.color === suggested);
  if (isValidPreset && !alreadyUsed) return suggested;
  return pickNextCourseColor(existingCourses);
}

export function pickNextCourseColor(existingCourses: Pick<Course, 'color'>[]): string {
  const counts = new Map(COURSE_COLOR_PRESETS.map((p) => [p.value, 0]));
  for (const course of existingCourses) {
    if (course.color && counts.has(course.color)) {
      counts.set(course.color, (counts.get(course.color) ?? 0) + 1);
    }
  }
  let best = COURSE_COLOR_PRESETS[0].value;
  let bestCount = Infinity;
  for (const preset of COURSE_COLOR_PRESETS) {
    const count = counts.get(preset.value) ?? 0;
    if (count < bestCount) {
      best = preset.value;
      bestCount = count;
    }
  }
  return best;
}
