'use client';

import { Card } from '@/components/ui/Card';
import { CardActionButton } from '@/components/ui/CardAction';
import { BackLink } from '@/components/ui/BackLink';
import { describeContents } from '@/lib/archive/contents';
import { useAppState } from '@/context/AppStateContext';
import { countContents, useCourseArchive } from '@/components/courses/useCourseArchive';
import type { Course } from '@/types/schedule';

/**
 * Shown at an archived course's own address instead of "Course not found":
 * it is kept, just out of use, and one tap brings it back (the full page
 * appears in place once it is restored).
 */
export function ArchivedCourseNotice({ course }: { course: Course }) {
  const { archived } = useAppState();
  const { restore, busy } = useCourseArchive();
  const contents = countContents(course.id, archived);

  return (
    <div className="max-w-3xl space-y-4" data-testid="archived-course-notice">
      <BackLink href="/courses">Back to courses</BackLink>
      <Card className="rounded-2xl p-6">
        <h1 className="font-display text-2xl font-medium tracking-tight text-foreground">
          {course.code} is archived
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{course.title}</p>
        <p className="mt-3 text-sm text-muted-foreground">
          It is kept with {describeContents(contents)}, but left out of your dashboard, calendar and
          Advisor. Restore it to bring it all back.
        </p>
        <div className="mt-4">
          <CardActionButton
            variant="primary"
            onClick={() => void restore(course)}
            disabled={busy !== null}
          >
            {busy === 'restore' ? 'Restoring…' : 'Restore course'}
          </CardActionButton>
        </div>
      </Card>
    </div>
  );
}
