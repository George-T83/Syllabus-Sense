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

export type RouteStopState = 'done' | 'current' | 'planned';

export interface RouteStop {
  term: string;
  credits: number;
  courseCount: number;
  /** Credits on the route up to and including this term. */
  cumulativeCredits: number;
  state: RouteStopState;
}

export interface DegreeRoute {
  stops: RouteStop[];
  creditsRequired: number;
  /** Completed + in-progress credits. */
  creditsEarned: number;
  /** Every credit on the route, planned ones included. */
  creditsOnRoute: number;
  /** Credits the plan doesn't cover yet. */
  creditsUnplanned: number;
  /** The last planned term, when the plan reaches the requirement. */
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
  const creditsEarned = courses
    .filter((c) => c.status !== 'planned')
    .reduce((sum, c) => sum + c.credits, 0);
  const creditsUnplanned = Math.max(0, creditsRequired - running);
  return {
    stops,
    creditsRequired,
    creditsEarned,
    creditsOnRoute: running,
    creditsUnplanned,
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
