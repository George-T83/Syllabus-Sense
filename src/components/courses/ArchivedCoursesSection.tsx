'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { ConfirmDeleteInline } from '@/components/ui/ConfirmDeleteInline';
import { RowActionButton } from '@/components/ui/RowActionButton';
import { useAppState } from '@/context/AppStateContext';
import { courseSwatch } from '@/lib/courseColors';
import { SHORT_DATE_FORMATTER } from '@/lib/dateFormatters';
import { courseTermLabel } from '@/lib/terms/termResolve';
import { describeContents } from '@/lib/archive/contents';
import { countContents, useCourseArchive } from '@/components/courses/useCourseArchive';
import { cn } from '@/lib/utils';

/**
 * The courses the student has archived, each with a one-tap Restore. Shown
 * under the course list whenever there is at least one, including when every
 * course is archived and the list above is empty.
 */
export function ArchivedCoursesSection() {
  const { state, archived } = useAppState();
  const { restore, deleteForever, busy } = useCourseArchive();
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [workingId, setWorkingId] = useState<string | null>(null);

  if (archived.courses.length === 0) return null;

  const courses = [...archived.courses].sort((a, b) =>
    (b.archivedAt ?? '').localeCompare(a.archivedAt ?? ''),
  );

  return (
    <Card className="rounded-2xl p-6" data-testid="archived-courses">
      <h2 className="text-base font-semibold text-foreground">
        Archived <span className="font-normal text-muted-foreground">({courses.length})</span>
      </h2>
      <p className="mt-0.5 text-sm text-muted-foreground">
        Kept with everything in them, and left out of your dashboard, calendar and Advisor until you
        restore them.
      </p>

      <ul className="mt-4 divide-y divide-border">
        {courses.map((course) => {
          const swatch = courseSwatch(course.color);
          const contents = countContents(course.id, archived);
          const term = courseTermLabel(course, state.terms);
          const confirming = confirmingId === course.id;
          const working = workingId === course.id && busy !== null;
          return (
            <li
              key={course.id}
              className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 items-start gap-3">
                <span
                  aria-hidden="true"
                  className={cn('mt-1 h-3 w-3 shrink-0 rounded-full', swatch.className)}
                  style={swatch.style}
                />
                <div className="min-w-0">
                  <div className="font-semibold text-foreground">{course.code}</div>
                  <div className="text-sm text-muted-foreground">{course.title}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {[
                      term,
                      course.archivedAt
                        ? `Archived ${SHORT_DATE_FORMATTER.format(new Date(course.archivedAt))}`
                        : null,
                      describeContents(contents),
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-x-2 gap-y-3 sm:justify-end">
                {confirming ? (
                  <ConfirmDeleteInline
                    deleting={working}
                    onConfirm={async () => {
                      setWorkingId(course.id);
                      const items = archived.scheduleItems.filter((i) => i.courseId === course.id);
                      const contacts = archived.contacts.filter((c) => c.courseId === course.id);
                      await deleteForever(course, items, contacts);
                      setWorkingId(null);
                      setConfirmingId(null);
                    }}
                    onCancel={() => setConfirmingId(null)}
                    size="lg"
                    confirmLabel="Delete forever"
                    message={`Delete ${course.code} for good?`}
                  />
                ) : (
                  <>
                    <RowActionButton
                      className="min-h-11 min-w-[44px]"
                      aria-label={`Restore ${course.code}`}
                      disabled={busy !== null}
                      onClick={async () => {
                        setWorkingId(course.id);
                        await restore(course);
                        setWorkingId(null);
                      }}
                    >
                      {working && busy === 'restore' ? 'Restoring…' : 'Restore'}
                    </RowActionButton>
                    <RowActionButton
                      tone="destructive"
                      className="min-h-11 min-w-[44px]"
                      aria-label={`Delete ${course.code} forever`}
                      disabled={busy !== null}
                      onClick={() => setConfirmingId(course.id)}
                    >
                      Delete forever
                    </RowActionButton>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
