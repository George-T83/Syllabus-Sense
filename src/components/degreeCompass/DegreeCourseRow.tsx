'use client';

import { useState } from 'react';
import type { DegreeCourse } from '@/types/degreeCompass';

const STATUS_LABEL: Record<DegreeCourse['status'], string> = {
  completed: 'Completed',
  'in-progress': 'In progress',
  planned: 'Planned',
};

const STATUS_CLASS: Record<DegreeCourse['status'], string> = {
  completed: 'bg-primary/10 text-primary',
  'in-progress': 'bg-load-medium/10 text-load-medium',
  planned: 'bg-muted text-muted-foreground',
};

export interface DegreeCourseRowProps {
  course: DegreeCourse;
  categoryName?: string;
  onEdit: (course: DegreeCourse) => void;
  onDelete: (course: DegreeCourse) => Promise<void>;
}

export function DegreeCourseRow({ course, categoryName, onEdit, onDelete }: DegreeCourseRowProps) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleConfirmDelete = async () => {
    setDeleting(true);
    try {
      await onDelete(course);
    } finally {
      setDeleting(false);
      setConfirmingDelete(false);
    }
  };

  return (
    <li className="group flex items-start justify-between gap-3 rounded-lg border border-border p-3 text-sm text-foreground transition-colors hover:border-primary/30">
      <div className="min-w-0 space-y-0.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{course.code}</span>
          {course.title && (
            <span className="text-muted-foreground break-words">{course.title}</span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>{course.credits} cr</span>
          <span aria-hidden="true">·</span>
          <span>{course.term}</span>
          {categoryName && (
            <>
              <span aria-hidden="true">·</span>
              <span>{categoryName}</span>
            </>
          )}
          <span className={`rounded-full px-2 py-0.5 font-semibold ${STATUS_CLASS[course.status]}`}>
            {STATUS_LABEL[course.status]}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0 opacity-80 transition-opacity group-hover:opacity-100">
        {confirmingDelete ? (
          <div className="flex items-center gap-1.5 text-xs whitespace-nowrap">
            <button
              type="button"
              onClick={handleConfirmDelete}
              disabled={deleting}
              className="rounded-full bg-destructive/10 px-2.5 py-1 font-semibold text-destructive transition-colors hover:bg-destructive/20 disabled:opacity-50"
            >
              {deleting ? 'Deleting…' : 'Confirm'}
            </button>
            <button
              type="button"
              onClick={() => setConfirmingDelete(false)}
              disabled={deleting}
              className="rounded-full px-2.5 py-1 text-muted-foreground transition-colors hover:bg-accent disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={() => onEdit(course)}
              className="rounded-full px-2.5 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary/10"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              className="rounded-full px-2.5 py-1 text-xs font-semibold text-destructive transition-colors hover:bg-destructive/10"
            >
              Delete
            </button>
          </>
        )}
      </div>
    </li>
  );
}
