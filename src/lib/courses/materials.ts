import type { Course, MaterialItem } from '@/types/schedule';

/**
 * Reads a course's materials safely regardless of whether they're the
 * current `MaterialItem` shape or a plain string left over from before the
 * `cost` field existed. Every call site should read materials through this
 * rather than assuming `course.materials` is already normalized.
 */
export function normalizeMaterials(materials: unknown): MaterialItem[] {
  if (!Array.isArray(materials)) return [];
  return materials.map((m) => (typeof m === 'string' ? { name: m } : (m as MaterialItem)));
}

/** Sums the recorded costs for one course's materials, skipping any without a cost. */
export function sumMaterialCosts(materials: MaterialItem[]): number {
  return materials.reduce((sum, m) => sum + (m.cost ?? 0), 0);
}

/** Sums material costs across every given course - the "semester total". */
export function sumAllCourseMaterialCosts(courses: Pick<Course, 'materials'>[]): number {
  return courses.reduce(
    (sum, course) => sum + sumMaterialCosts(normalizeMaterials(course.materials)),
    0,
  );
}
