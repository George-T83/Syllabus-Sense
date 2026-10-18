import {
  buildDegreeRoute,
  computeCategoryProgress,
  computeOverallProgress,
  type CategoryShortfall,
  type OverallProgress,
} from '@/lib/degreeCompass/progress';
import type { DegreeCourse, DegreeRequirementCategory } from '@/types/degreeCompass';

/**
 * "What if" planning for Degree Compass. Everything here is pure: it works on
 * copies and never writes anything. Hypothetical courses live only in the
 * caller's state.
 *
 * Limits, on purpose: this works in credits per requirement category. It does
 * not know about specific courses, prerequisites, offerings or schedules, so
 * a plan it produces says "12 credits of Major Core next term", not which
 * courses to take.
 */

/** A course the student is only trying out. Never persisted. */
export interface HypotheticalCourse {
  id: string;
  credits: number;
  categoryId: string;
}

export type IgnoredReason = 'unknown-category' | 'invalid-credits';

export interface IgnoredHypothetical {
  course: HypotheticalCourse;
  reason: IgnoredReason;
}

/** Credit arithmetic is done in thousandths so 0.1 + 0.2 stays 0.3. */
const MILLI = 1000;

function toMilli(credits: number): number {
  return Math.round(credits * MILLI);
}

function fromMilli(milli: number): number {
  return milli / MILLI;
}

/** Rounds away floating point noise from summed fractional credits. */
function clean(credits: number): number {
  return fromMilli(toMilli(credits));
}

function cleanOverall(p: OverallProgress): OverallProgress {
  return {
    creditsRequired: clean(p.creditsRequired),
    creditsCompleted: clean(p.creditsCompleted),
    creditsInProgress: clean(p.creditsInProgress),
    creditsExtra: clean(p.creditsExtra),
  };
}

/**
 * Splits the hypothetical courses into the ones that can count and the ones
 * that cannot: a category the degree does not have, or credits that are not
 * a positive finite number, count for nothing.
 */
export function partitionHypotheticals(
  categories: DegreeRequirementCategory[],
  hypothetical: HypotheticalCourse[],
): { counted: HypotheticalCourse[]; ignored: IgnoredHypothetical[] } {
  const known = new Set(categories.map((c) => c.id));
  const counted: HypotheticalCourse[] = [];
  const ignored: IgnoredHypothetical[] = [];
  for (const course of hypothetical) {
    if (!Number.isFinite(course.credits) || toMilli(course.credits) <= 0) {
      ignored.push({ course, reason: 'invalid-credits' });
    } else if (!known.has(course.categoryId)) {
      ignored.push({ course, reason: 'unknown-category' });
    } else {
      counted.push(course);
    }
  }
  return { counted, ignored };
}

/** The label hypothetical courses carry in the copied plan. */
export const HYPOTHETICAL_TERM = 'What if';

/**
 * A copy of the plan with the hypothetical courses added as completed -
 * "where would I land once I have taken these". The input array and its
 * courses are not modified. Hypothetical courses that cannot count (see
 * `partitionHypotheticals`) are left out.
 */
export function addHypotheticalCourses(
  categories: DegreeRequirementCategory[],
  courses: DegreeCourse[],
  hypothetical: HypotheticalCourse[],
): DegreeCourse[] {
  const { counted } = partitionHypotheticals(categories, hypothetical);
  return [
    ...courses.map((c) => ({ ...c })),
    ...counted.map((h): DegreeCourse => ({
      id: `what-if-${h.id}`,
      term: HYPOTHETICAL_TERM,
      code: `What if ${h.id}`,
      credits: h.credits,
      categoryId: h.categoryId,
      status: 'completed',
    })),
  ];
}

export interface WhatIfCategoryChange {
  category: DegreeRequirementCategory;
  /** Completed + in-progress credits counting toward the requirement,
   * capped at what the category asks for. */
  earnedBefore: number;
  earnedAfter: number;
  /** Credits past the requirement. They do not close a gap elsewhere. */
  extraBefore: number;
  extraAfter: number;
  remainingBefore: number;
  remainingAfter: number;
}

export interface WhatIfResult {
  before: OverallProgress;
  after: OverallProgress;
  /** Credits that now count toward a requirement (completed + in progress,
   * after minus before). Excess past a category's cap is not in here. */
  creditsGained: number;
  /** Change in credits sitting past a requirement. */
  extraGained: number;
  categories: WhatIfCategoryChange[];
  counted: HypotheticalCourse[];
  ignored: IgnoredHypothetical[];
  /** What the plan still does not cover after the hypothetical courses,
   * biggest gap first. Planned courses already on the plan count as cover. */
  shortfallsAfter: CategoryShortfall[];
  creditsUnplannedAfter: number;
  /** Whether every requirement is met by earned + in-progress credits. */
  completeAfter: boolean;
}

/**
 * Where the student lands if they take the hypothetical courses. Each
 * category counts only up to what it requires, exactly as
 * `computeOverallProgress` does, so credits beyond a category's cap are
 * reported as extra and never count twice or cover another category.
 */
export function projectWhatIf(
  categories: DegreeRequirementCategory[],
  courses: DegreeCourse[],
  hypothetical: HypotheticalCourse[],
): WhatIfResult {
  const { counted, ignored } = partitionHypotheticals(categories, hypothetical);
  const withHypothetical = addHypotheticalCourses(categories, courses, hypothetical);

  const before = cleanOverall(computeOverallProgress(categories, courses));
  const after = cleanOverall(computeOverallProgress(categories, withHypothetical));

  const beforeByCategory = computeCategoryProgress(categories, courses);
  const afterByCategory = computeCategoryProgress(categories, withHypothetical);
  const changes = categories.map((category, i): WhatIfCategoryChange => {
    const b = beforeByCategory[i];
    const a = afterByCategory[i];
    const required = category.creditsRequired;
    const earnedB = b.creditsCompleted + b.creditsInProgress;
    const earnedA = a.creditsCompleted + a.creditsInProgress;
    return {
      category,
      earnedBefore: clean(Math.min(earnedB, required)),
      earnedAfter: clean(Math.min(earnedA, required)),
      extraBefore: clean(Math.max(0, earnedB - required)),
      extraAfter: clean(Math.max(0, earnedA - required)),
      remainingBefore: clean(b.creditsRemaining),
      remainingAfter: clean(a.creditsRemaining),
    };
  });

  const route = buildDegreeRoute(categories, withHypothetical);
  const shortfallsAfter = route.shortfalls.map((s) => ({ ...s, credits: clean(s.credits) }));

  return {
    before,
    after,
    creditsGained: clean(
      after.creditsCompleted +
        after.creditsInProgress -
        before.creditsCompleted -
        before.creditsInProgress,
    ),
    extraGained: clean(after.creditsExtra - before.creditsExtra),
    categories: changes,
    counted,
    ignored,
    shortfallsAfter,
    creditsUnplannedAfter: clean(route.creditsUnplanned),
    completeAfter: changes.every((c) => c.remainingAfter === 0),
  };
}

export interface PlannedTermItem {
  name: string;
  credits: number;
}

export interface PlannedTerm {
  /** 1-based position among the remaining terms. */
  number: number;
  credits: number;
  items: PlannedTermItem[];
}

export type TermPlanProblem = 'invalid-max' | 'too-many-terms';

export interface TermPlan {
  terms: PlannedTerm[];
  totalCredits: number;
  maxCreditsPerTerm: number;
  /** Set when no plan could be made; `terms` is empty then. A plan with
   * `problem: null` and no terms means nothing is left to schedule. */
  problem: TermPlanProblem | null;
}

/** More terms than this is not a plan anyone is making; it also keeps a
 * tiny `maxCreditsPerTerm` from building an enormous list. */
export const MAX_PLANNED_TERMS = 40;

/**
 * Packs the remaining credits into the fewest terms of at most
 * `maxCreditsPerTerm` credits each. Deterministic: biggest shortfall first
 * (ties by name, then input order), filling each term in turn, so the term
 * count is always ceil(total / max) and every term but the last is full.
 *
 * Credits are treated as divisible. A category's credits may be split across
 * terms and a term may hold, say, 2 credits of a 3-credit course; the planner
 * does not know about courses, so a cap below the size of the courses you
 * would take can be impossible in practice. Prerequisites and when courses
 * are offered are not considered either. Credits resolve to a thousandth.
 */
export function planTerms(shortfalls: CategoryShortfall[], maxCreditsPerTerm: number): TermPlan {
  const maxMilli = Number.isFinite(maxCreditsPerTerm) ? toMilli(maxCreditsPerTerm) : 0;
  if (maxMilli <= 0) {
    return { terms: [], totalCredits: 0, maxCreditsPerTerm, problem: 'invalid-max' };
  }

  const queue = shortfalls
    .map((s, index) => ({
      name: s.name,
      milli: Number.isFinite(s.credits) ? toMilli(s.credits) : 0,
      index,
    }))
    .filter((s) => s.milli > 0)
    .sort((a, b) => b.milli - a.milli || a.name.localeCompare(b.name) || a.index - b.index);

  const totalMilli = queue.reduce((sum, s) => sum + s.milli, 0);
  const termCount = Math.ceil(totalMilli / maxMilli);
  if (termCount > MAX_PLANNED_TERMS) {
    return {
      terms: [],
      totalCredits: fromMilli(totalMilli),
      maxCreditsPerTerm,
      problem: 'too-many-terms',
    };
  }

  const terms: PlannedTerm[] = [];
  let cursor = 0;
  while (cursor < queue.length) {
    let room = maxMilli;
    const items: PlannedTermItem[] = [];
    while (room > 0 && cursor < queue.length) {
      const entry = queue[cursor];
      const take = Math.min(entry.milli, room);
      items.push({ name: entry.name, credits: fromMilli(take) });
      entry.milli -= take;
      room -= take;
      if (entry.milli === 0) cursor += 1;
    }
    terms.push({
      number: terms.length + 1,
      credits: fromMilli(maxMilli - room),
      items,
    });
  }

  return { terms, totalCredits: fromMilli(totalMilli), maxCreditsPerTerm, problem: null };
}
