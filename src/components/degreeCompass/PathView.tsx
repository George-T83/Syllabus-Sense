import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { DegreeCourseRow } from './DegreeCourseRow';
import { CategoryProgressBar } from './CategoryProgressBar';
import { computeCategoryProgress, groupCoursesByTerm } from '@/lib/degreeCompass/progress';
import type { DegreeCourse, DegreeRequirementCategory } from '@/types/degreeCompass';

export interface PathViewProps {
  categories: DegreeRequirementCategory[];
  courses: DegreeCourse[];
  onEditCourse: (course: DegreeCourse) => void;
  onDeleteCourse: (course: DegreeCourse) => Promise<void>;
}

export function PathView({ categories, courses, onEditCourse, onDeleteCourse }: PathViewProps) {
  const terms = groupCoursesByTerm(courses);
  const categoryProgress = computeCategoryProgress(categories, courses);
  const categoryNameById = new Map(categories.map((c) => [c.id, c.name]));

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
      <div className="space-y-4">
        {terms.length === 0 ? (
          <Card className="rounded-2xl p-6">
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
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              }
              title="No courses on your path yet"
              description='Add your first course with "Add course" above.'
            />
          </Card>
        ) : (
          terms.map((group) => (
            <Card key={group.term} className="rounded-2xl p-6 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-base font-semibold text-foreground">{group.term}</h2>
                <span className="text-xs text-muted-foreground">{group.totalCredits} credits</span>
              </div>
              <ul className="flex flex-col gap-2">
                {group.courses.map((course) => (
                  <DegreeCourseRow
                    key={course.id}
                    course={course}
                    categoryName={categoryNameById.get(course.categoryId)}
                    onEdit={onEditCourse}
                    onDelete={onDeleteCourse}
                  />
                ))}
              </ul>
            </Card>
          ))
        )}
      </div>

      <Card className="rounded-2xl p-5 space-y-4 h-fit">
        <h2 className="text-sm font-semibold text-foreground">Requirements</h2>
        <div className="space-y-4">
          {categoryProgress.map((progress) => (
            <CategoryProgressBar key={progress.category.id} progress={progress} />
          ))}
        </div>
      </Card>
    </div>
  );
}
