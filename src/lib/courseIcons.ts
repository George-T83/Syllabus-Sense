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

/** Mirrors pickSuggestedCourseColor's shape, but simpler: unlike color,
 * two same-subject courses sharing an icon is fine (color still tells them
 * apart), so an invalid or missing suggestion just falls back to the
 * default rather than needing a least-used rotation. */
export function pickSuggestedCourseIcon(suggested: string | null | undefined): string {
  return suggested && ICON_VALUES.includes(suggested) ? suggested : DEFAULT_COURSE_ICON;
}
