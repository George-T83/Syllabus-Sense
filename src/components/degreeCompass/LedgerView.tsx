'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { DegreeCourseRow } from './DegreeCourseRow';
import { CategoryProgressBar } from './CategoryProgressBar';
import { computeCategoryProgress, sortCoursesByTerm } from '@/lib/degreeCompass/progress';
import type { DegreeCourse, DegreeRequirementCategory } from '@/types/degreeCompass';

export interface LedgerViewProps {
  categories: DegreeRequirementCategory[];
  courses: DegreeCourse[];
  onEditCourse: (course: DegreeCourse) => void;
  onDeleteCourse: (course: DegreeCourse) => Promise<void>;
}

export function LedgerView({ categories, courses, onEditCourse, onDeleteCourse }: LedgerViewProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set(categories.map((c) => c.id)));
  const categoryProgress = computeCategoryProgress(categories, courses);

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      {categoryProgress.map((progress) => {
        const { category } = progress;
        const categoryCourses = sortCoursesByTerm(
          courses.filter((c) => c.categoryId === category.id),
        );
        const isExpanded = expandedIds.has(category.id);

        return (
          <Card key={category.id} className="rounded-2xl p-6 space-y-3">
            <button
              type="button"
              onClick={() => toggleExpanded(category.id)}
              className="flex w-full items-center justify-between gap-4 text-left"
              aria-expanded={isExpanded}
            >
              <div className="flex-1 min-w-0">
                <CategoryProgressBar progress={progress} />
              </div>
              <svg
                className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {isExpanded &&
              (categoryCourses.length > 0 ? (
                <ul className="flex flex-col gap-2 pt-1">
                  {categoryCourses.map((course) => (
                    <DegreeCourseRow
                      key={course.id}
                      course={course}
                      onEdit={onEditCourse}
                      onDelete={onDeleteCourse}
                    />
                  ))}
                </ul>
              ) : (
                <EmptyState
                  icon={
                    <svg
                      className="h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  }
                  title="No courses in this category yet"
                />
              ))}
          </Card>
        );
      })}
    </div>
  );
}
