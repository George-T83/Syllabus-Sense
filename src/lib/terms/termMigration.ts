import type { Course } from '@/types/schedule';
import type { Term } from '@/types/term';
import { standardTermDates, termLabelKey } from '@/lib/terms/standardTerms';
import { findTermByLabel } from '@/lib/terms/termResolve';

/** A stable id for a term made from a label, so two devices that migrate the
 * same account at once write the same document instead of two. */
export function termIdForLabel(label: string): string {
  const key = termLabelKey(label);
  let hash = 2166136261;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const slug = key.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `term-${slug || 'x'}-${(hash >>> 0).toString(36)}`;
}

export interface TermMigrationPlan {
  /** Terms to create: labels with standard dates, pre-filled with them. */
  newTerms: Term[];
  /** Courses to point at a term (new or already stored). */
  courseLinks: { courseId: string; termId: string }[];
  /** Labels on courses that have no standard dates and no term yet: the
   * student is asked for their first and last day, never guessed. */
  unknownLabels: string[];
}

/**
 * Works out how to turn the plain-text `term` labels on existing courses into
 * term objects. Only ever adds: a course keeps its label and every other
 * field, and gains a `termId`. A course already linked to a stored term is
 * left alone.
 */
export function planTermMigration(courses: Course[], terms: Term[]): TermMigrationPlan {
  const known = [...terms];
  const newTerms: Term[] = [];
  const courseLinks: TermMigrationPlan['courseLinks'] = [];
  const unknownLabels: string[] = [];

  for (const course of courses) {
    if (course.termId && terms.some((t) => t.id === course.termId)) continue;
    const label = course.term?.trim();
    if (!label) continue;

    let term = findTermByLabel(known, label);
    if (!term) {
      const standard = standardTermDates(label);
      if (!standard) {
        if (!unknownLabels.some((l) => termLabelKey(l) === termLabelKey(label))) {
          unknownLabels.push(label);
        }
        continue;
      }
      term = { id: termIdForLabel(label), label, ...standard };
      known.push(term);
      newTerms.push(term);
    }
    courseLinks.push({ courseId: course.id, termId: term.id });
  }
  return { newTerms, courseLinks, unknownLabels };
}

export function isEmptyPlan(plan: TermMigrationPlan): boolean {
  return plan.newTerms.length === 0 && plan.courseLinks.length === 0;
}
