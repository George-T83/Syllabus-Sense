import type { GradeCategory } from '@/lib/academic/gradeMath';

/**
 * A saved what-if grade simulation for a course - the inputs to the
 * calculator (category weights/scores, final exam weight, target
 * percentage), named and persisted so a student can come back to "Best
 * case" or "If I bomb the final" without re-entering every number.
 */
export interface GradeScenario {
  id: string;
  courseId: string;
  name: string;
  categories: GradeCategory[];
  finalExamWeight: number;
  targetPercentage: number;
  createdAt: string;
}
