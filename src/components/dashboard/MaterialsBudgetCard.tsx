'use client';

import { Card } from '@/components/ui/Card';
import { normalizeMaterials, sumMaterialCosts } from '@/lib/courses/materials';
import type { Course } from '@/types/schedule';

export interface MaterialsBudgetCardProps {
  courses: Course[];
}

/** A running semester total for course materials with a recorded cost -
 * renders nothing until at least one material actually has a cost on file,
 * so a brand-new account (or one that only ever uses free/no-cost
 * materials) never sees an empty "$0.00" card. */
export function MaterialsBudgetCard({ courses }: MaterialsBudgetCardProps) {
  const courseTotals = courses
    .map((course) => ({
      course,
      total: sumMaterialCosts(normalizeMaterials(course.materials)),
    }))
    .filter((entry) => entry.total > 0)
    .sort((a, b) => b.total - a.total);

  const semesterTotal = courseTotals.reduce((sum, entry) => sum + entry.total, 0);

  if (semesterTotal === 0) return null;

  return (
    <Card accent="none" className="rounded-2xl border-primary/20 bg-primary/5 p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-bold text-primary">Semester Materials Budget</h2>
        <span className="text-lg font-extrabold text-primary">${semesterTotal.toFixed(2)}</span>
      </div>
      <ul className="mt-3 space-y-1">
        {courseTotals.map(({ course, total }) => (
          <li
            key={course.id}
            className="flex items-center justify-between text-xs text-muted-foreground"
          >
            <span className="truncate">{course.code}</span>
            <span className="shrink-0 font-semibold">${total.toFixed(2)}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
