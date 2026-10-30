import type { Course } from '@/types/schedule';
import type { Term } from '@/types/term';
import { termLabelKey } from '@/lib/terms/standardTerms';

type CourseTermRef = Pick<Course, 'term' | 'termId'>;

/** The term with this label, ignoring case and spacing. */
export function findTermByLabel(terms: Term[], label: string): Term | undefined {
  const key = termLabelKey(label);
  return key ? terms.find((t) => termLabelKey(t.label) === key) : undefined;
}

/**
 * The term object a course belongs to: the one it points at by `termId`, or,
 * for a course that has not been linked yet, the one its plain-text `term`
 * label names.
 */
export function courseTerm(course: CourseTermRef, terms: Term[]): Term | undefined {
  const linked = course.termId ? terms.find((t) => t.id === course.termId) : undefined;
  if (linked) return linked;
  return course.term ? findTermByLabel(terms, course.term) : undefined;
}

export function courseInTerm(course: CourseTermRef, term: Term, terms: Term[]): boolean {
  return courseTerm(course, terms)?.id === term.id;
}

/** What to show for a course's term: the term's label, or the course's own
 * label when it has no term object yet. */
export function courseTermLabel(course: CourseTermRef, terms: Term[]): string | undefined {
  return courseTerm(course, terms)?.label ?? (course.term || undefined);
}

/** The fields a course stores for a term: the link, plus the label kept
 * alongside it for contacts, the advisor and anything else that reads text. */
export function termFields(term: Term | null | undefined): { termId?: string; term?: string } {
  return term ? { termId: term.id, term: term.label } : {};
}

/** Terms in the order they run, earliest first. */
export function sortTerms(terms: Term[]): Term[] {
  return [...terms].sort(
    (a, b) => a.startDate.localeCompare(b.startDate) || a.label.localeCompare(b.label),
  );
}

/**
 * The "current" term when the student has not chosen one: the term most of
 * their courses belong to. (Ties keep the first one found.)
 */
export function inferCurrentTerm(courses: CourseTermRef[], terms: Term[]): Term | null {
  const counts = new Map<string, number>();
  for (const course of courses) {
    const term = courseTerm(course, terms);
    if (term) counts.set(term.id, (counts.get(term.id) ?? 0) + 1);
  }
  let best: Term | null = null;
  let bestCount = 0;
  for (const term of terms) {
    const count = counts.get(term.id) ?? 0;
    if (count > bestCount) {
      best = term;
      bestCount = count;
    }
  }
  return best;
}

/**
 * The term the app is scoped to, given the stored choice (`selectedTerm`: a
 * term id, 'all', or null for no choice yet; a term label saved by an older
 * version also matches) and the student's courses. `null` means every term.
 * A choice that matches no term is treated as no choice.
 */
export function resolveActiveTerm(
  selectedTerm: string | null,
  courses: CourseTermRef[],
  terms: Term[],
): Term | null {
  if (selectedTerm === 'all') return null;
  if (selectedTerm) {
    const chosen = terms.find((t) => t.id === selectedTerm) ?? findTermByLabel(terms, selectedTerm);
    if (chosen) return chosen;
  }
  return inferCurrentTerm(courses, terms);
}

/** The course form's value for a course whose plain-text term label has no
 * term object yet, so editing the course keeps that label instead of
 * dropping it. */
export const LEGACY_TERM_VALUE = '__legacy__';

/** The term fields to store for what the course form's term picker holds. */
export function termFieldsFromForm(
  termId: string | undefined,
  terms: Term[],
  legacyLabel?: string,
): { termId?: string; term?: string } {
  if (!termId) return {};
  if (termId === LEGACY_TERM_VALUE) return legacyLabel ? { term: legacyLabel } : {};
  return termFields(terms.find((t) => t.id === termId));
}

/**
 * The term a single-term view (like the check-in history grid) should draw:
 * the active term, or, when none is active (every term selected, or no
 * course is linked to a term), the stored term that contains `todayKey`,
 * else the most recently started one. Only terms the student has defined are
 * considered; `null` when there are none.
 */
export function termForSingleView(
  active: Term | null,
  terms: Term[],
  todayKey: string,
): Term | null {
  if (active) return active;
  const containing = terms.find((t) => t.startDate <= todayKey && todayKey <= t.endDate);
  if (containing) return containing;
  const started = sortTerms(terms).filter((t) => t.startDate <= todayKey);
  return started.at(-1) ?? sortTerms(terms)[0] ?? null;
}
