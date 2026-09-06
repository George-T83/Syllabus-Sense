import { estimateTermRange } from '@/lib/calendar/termDates';
import type { DegreeCourse, DegreeRequirementCategory } from '@/types/degreeCompass';

export interface CategoryProgress {
  category: DegreeRequirementCategory;
  creditsCompleted: number;
  creditsInProgress: number;
  creditsRemaining: number;
}

/** Only completed and in-progress courses count toward "earned" credits -
 * a planned course hasn't happened yet, so it shouldn't read as progress
 * made, only as part of the plan (surfaced separately by the caller). */
export function computeCategoryProgress(
  categories: DegreeRequirementCategory[],
  courses: DegreeCourse[],
): CategoryProgress[] {
  return categories.map((category) => {
    const inCategory = courses.filter((c) => c.categoryId === category.id);
    const creditsCompleted = inCategory
      .filter((c) => c.status === 'completed')
      .reduce((sum, c) => sum + c.credits, 0);
    const creditsInProgress = inCategory
      .filter((c) => c.status === 'in-progress')
      .reduce((sum, c) => sum + c.credits, 0);
    const creditsRemaining = Math.max(
      0,
      category.creditsRequired - creditsCompleted - creditsInProgress,
    );
    return { category, creditsCompleted, creditsInProgress, creditsRemaining };
  });
}

export interface OverallProgress {
  creditsRequired: number;
  creditsCompleted: number;
  creditsInProgress: number;
}

export function computeOverallProgress(
  categories: DegreeRequirementCategory[],
  courses: DegreeCourse[],
): OverallProgress {
  const perCategory = computeCategoryProgress(categories, courses);
  return {
    creditsRequired: categories.reduce((sum, c) => sum + c.creditsRequired, 0),
    creditsCompleted: perCategory.reduce((sum, c) => sum + c.creditsCompleted, 0),
    creditsInProgress: perCategory.reduce((sum, c) => sum + c.creditsInProgress, 0),
  };
}

export interface TermGroup {
  term: string;
  courses: DegreeCourse[];
  totalCredits: number;
}

/** Orders two term labels chronologically where parseable (estimateTermRange)
 * and alphabetically otherwise, so an unparseable label never crashes the
 * sort - it just sorts after every term that could be dated. */
export function compareTerms(a: string, b: string): number {
  const aStart = estimateTermRange(a)?.start;
  const bStart = estimateTermRange(b)?.start;
  if (aStart && bStart) return aStart.getTime() - bStart.getTime();
  if (aStart) return -1;
  if (bStart) return 1;
  return a.localeCompare(b);
}

/** Sorts courses chronologically by term (then by code within a term), so a
 * student's course list reads in the order they'll actually take it rather
 * than in arbitrary Firestore snapshot order. */
export function sortCoursesByTerm(courses: DegreeCourse[]): DegreeCourse[] {
  return [...courses].sort((a, b) => compareTerms(a.term, b.term) || a.code.localeCompare(b.code));
}

/** Groups courses by term, sorted chronologically. */
export function groupCoursesByTerm(courses: DegreeCourse[]): TermGroup[] {
  const byTerm = new Map<string, DegreeCourse[]>();
  for (const course of sortCoursesByTerm(courses)) {
    const list = byTerm.get(course.term) ?? [];
    list.push(course);
    byTerm.set(course.term, list);
  }

  const groups: TermGroup[] = Array.from(byTerm.entries()).map(([term, termCourses]) => ({
    term,
    courses: termCourses,
    totalCredits: termCourses.reduce((sum, c) => sum + c.credits, 0),
  }));

  groups.sort((a, b) => compareTerms(a.term, b.term));

  return groups;
}
