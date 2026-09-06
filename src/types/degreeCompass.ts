/**
 * Degree Compass tracks progress toward graduation across the whole
 * program, not just the current term - deliberately its own small,
 * independent record rather than reusing the live `Course` type (which
 * models one term's syllabus/tasks/grades in detail). A degree course here
 * is a lightweight ledger entry: a code, a term, a credit count, and which
 * requirement category it counts toward.
 */
export type DegreeCourseStatus = 'completed' | 'in-progress' | 'planned';

export interface DegreeRequirementCategory {
  id: string;
  name: string;
  creditsRequired: number;
}

/** Singleton per user - the shape of the degree being tracked. */
export interface DegreeProfile {
  majorName: string;
  minorName?: string;
  categories: DegreeRequirementCategory[];
  updatedAt: string;
}

export interface DegreeCourse {
  id: string;
  term: string;
  code: string;
  title?: string;
  credits: number;
  categoryId: string;
  status: DegreeCourseStatus;
}

/** Seeded when a student sets up Degree Compass for the first time - the
 * same five-category, 120-credit structure used throughout the design
 * exploration (Major Core 30 / Electives 18 / Gen Ed 36 / Minor 18 / Free
 * Electives 18), editable afterward since real programs vary. */
export function buildDefaultCategories(includeMinor: boolean): DegreeRequirementCategory[] {
  const categories: DegreeRequirementCategory[] = [
    { id: crypto.randomUUID(), name: 'Major Core', creditsRequired: 30 },
    { id: crypto.randomUUID(), name: 'Major Electives', creditsRequired: 18 },
    { id: crypto.randomUUID(), name: 'General Education', creditsRequired: 36 },
  ];
  if (includeMinor) {
    categories.push({ id: crypto.randomUUID(), name: 'Minor', creditsRequired: 18 });
  }
  categories.push({
    id: crypto.randomUUID(),
    name: 'Free Electives',
    creditsRequired: includeMinor ? 18 : 36,
  });
  return categories;
}
