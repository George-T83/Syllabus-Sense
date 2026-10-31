'use client';

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { CardActionButton } from '@/components/ui/CardAction';
import { RowActionButton } from '@/components/ui/RowActionButton';
import { useModalA11y } from '@/hooks/useModalA11y';
import { describeContents, type CourseContents } from '@/lib/archive/contents';
import type { Course } from '@/types/schedule';
import type { CourseArchiveAction } from '@/components/courses/useCourseArchive';

interface DeleteCourseDialogProps {
  open: boolean;
  course: Pick<Course, 'code' | 'title'>;
  contents: CourseContents;
  /** The action in progress, which disables the others. */
  busy: CourseArchiveAction | null;
  onArchive: () => void;
  onDeleteForever: () => void;
  onClose: () => void;
}

/**
 * What deleting a course asks. Archive is the default (it has the focus and
 * the filled button) because it keeps everything and can be undone; Delete
 * forever is there, plainly worded, for the student who means it.
 */
export function DeleteCourseDialog({
  open,
  course,
  contents,
  busy,
  onArchive,
  onDeleteForever,
  onClose,
}: DeleteCourseDialogProps) {
  const dialogRef = useModalA11y<HTMLDivElement>(open, () => {
    if (!busy) onClose();
  });
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex overflow-y-auto bg-black/40 px-4 py-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-course-title"
      onClick={() => {
        if (!busy) onClose();
      }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="relative m-auto w-full max-w-md outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <Card accent="none" opaque>
          <CardHeader>
            <CardTitle id="delete-course-title">Archive or delete {course.code}?</CardTitle>
            <CardDescription>{course.title}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
              <h3 className="text-sm font-semibold text-foreground">Archive</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Keeps everything, including {describeContents(contents)}. The course leaves your
                dashboard, calendar, Advisor and calendar link until you restore it from Courses,
                under Archived.
              </p>
              <CardActionButton
                variant="primary"
                className="mt-3"
                onClick={onArchive}
                disabled={busy !== null}
                data-autofocus
              >
                {busy === 'archive' ? 'Archiving…' : 'Archive'}
              </CardActionButton>
            </div>

            <div className="rounded-xl border border-border p-4">
              <h3 className="text-sm font-semibold text-foreground">Delete forever</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Removes the course and {describeContents(contents)}, and any files you uploaded.
                This can&apos;t be undone.
              </p>
              <RowActionButton
                tone="destructive"
                className="mt-3 min-h-11"
                onClick={onDeleteForever}
                disabled={busy !== null}
              >
                {busy === 'delete' ? 'Deleting…' : 'Delete forever'}
              </RowActionButton>
            </div>

            <div className="flex justify-end">
              <CardActionButton variant="ghost" onClick={onClose} disabled={busy !== null}>
                Cancel
              </CardActionButton>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
