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
  /** Completed credits that count toward a requirement, each category
   * capped at what it asks for. */
  creditsCompleted: number;
  /** In-progress credits that still fit under a requirement. */
  creditsInProgress: number;
  /** Credits earned or in progress beyond what their category needs. They
   * are real, but they do not close a gap in another category. */
  creditsExtra: number;
}

/**
 * Progress across the whole degree, counted per category. A category only
 * contributes up to what it requires: 30 credits in a 12-credit elective
 * bucket is 12 toward the degree, with 18 extra, so surplus in one place can
 * never hide a shortfall in another. Courses filed under a category the
 * profile no longer has count for nothing.
 */
export function computeOverallProgress(
  categories: DegreeRequirementCategory[],
  courses: DegreeCourse[],
): OverallProgress {
  const perCategory = computeCategoryProgress(categories, courses);
  let creditsCompleted = 0;
  let creditsInProgress = 0;
  let creditsExtra = 0;
  for (const p of perCategory) {
    const required = p.category.creditsRequired;
    const completed = Math.min(p.creditsCompleted, required);
    const inProgress = Math.min(p.creditsInProgress, required - completed);
    creditsCompleted += completed;
    creditsInProgress += inProgress;
    creditsExtra += p.creditsCompleted + p.creditsInProgress - completed - inProgress;
  }
  return {
    creditsRequired: categories.reduce((sum, c) => sum + c.creditsRequired, 0),
    creditsCompleted,
    creditsInProgress,
    creditsExtra,
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

export type RouteStopState = 'done' | 'current' | 'planned';

export interface RouteStop {
  term: string;
  credits: number;
  courseCount: number;
  /** Credits on the route up to and including this term. */
  cumulativeCredits: number;
  state: RouteStopState;
}

/** A requirement the plan does not cover yet. */
export interface CategoryShortfall {
  name: string;
  /** Credits no completed, in-progress or planned course covers. */
  credits: number;
}

export interface DegreeRoute {
  stops: RouteStop[];
  creditsRequired: number;
  /** Completed + in-progress credits that count toward a requirement. */
  creditsEarned: number;
  /** Every credit on the route, planned ones included. */
  creditsOnRoute: number;
  /** Credits the plan doesn't cover yet, summed over the categories that
   * fall short - surplus elsewhere does not offset them. */
  creditsUnplanned: number;
  /** Which categories those credits are missing from, biggest gap first. */
  shortfalls: CategoryShortfall[];
  /** The last planned term, when every category is covered. */
  graduationTerm: string | null;
}

/**
 * The degree as a route: one stop per term, in order. A term is done when
 * every course in it is completed, current when anything in it is in
 * progress, and planned otherwise.
 */
export function buildDegreeRoute(
  categories: DegreeRequirementCategory[],
  courses: DegreeCourse[],
): DegreeRoute {
  const creditsRequired = categories.reduce((sum, c) => sum + c.creditsRequired, 0);
  let running = 0;
  const stops: RouteStop[] = groupCoursesByTerm(courses).map((group) => {
    running += group.totalCredits;
    const state: RouteStopState = group.courses.every((c) => c.status === 'completed')
      ? 'done'
      : group.courses.some((c) => c.status === 'in-progress')
        ? 'current'
        : 'planned';
    return {
      term: group.term,
      credits: group.totalCredits,
      courseCount: group.courses.length,
      cumulativeCredits: running,
      state,
    };
  });
  const overall = computeOverallProgress(categories, courses);
  const creditsEarned = overall.creditsCompleted + overall.creditsInProgress;
  // Per category: what is still uncovered once everything filed under it,
  // planned courses included, is counted.
  const shortfalls: CategoryShortfall[] = categories
    .map((category) => {
      const covered = courses
        .filter((c) => c.categoryId === category.id)
        .reduce((sum, c) => sum + c.credits, 0);
      return { name: category.name, credits: Math.max(0, category.creditsRequired - covered) };
    })
    .filter((s) => s.credits > 0)
    .sort((a, b) => b.credits - a.credits);
  const creditsUnplanned = shortfalls.reduce((sum, s) => sum + s.credits, 0);
  return {
    stops,
    creditsRequired,
    creditsEarned,
    creditsOnRoute: running,
    creditsUnplanned,
    shortfalls,
    graduationTerm:
      creditsUnplanned === 0 && stops.length > 0 ? stops[stops.length - 1].term : null,
  };
}

export interface CategoryCourseBlocks {
  /** The category's courses, completed first, then in progress, then planned. */
  blocks: DegreeCourse[];
  /** Credits still needed after completed and in-progress courses. */
  creditsLeft: number;
  /** Of `creditsLeft`, the part no planned course covers yet. */
  creditsUnplanned: number;
}

const STATUS_ORDER: Record<DegreeCourse['status'], number> = {
  completed: 0,
  'in-progress': 1,
  planned: 2,
};

/** One requirement's courses as blocks, plus what's left and whether the
 * plan covers it - the data behind "12 cr left, all planned". */
export function categoryCourseBlocks(
  category: DegreeRequirementCategory,
  courses: DegreeCourse[],
): CategoryCourseBlocks {
  const blocks = sortCoursesByTerm(courses.filter((c) => c.categoryId === category.id)).sort(
    (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status],
  );
  const earned = blocks.filter((c) => c.status !== 'planned').reduce((s, c) => s + c.credits, 0);
  const planned = blocks.filter((c) => c.status === 'planned').reduce((s, c) => s + c.credits, 0);
  const creditsLeft = Math.max(0, category.creditsRequired - earned);
  return { blocks, creditsLeft, creditsUnplanned: Math.max(0, creditsLeft - planned) };
}
