import type { ReactNode } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { courseBorderColor } from '@/lib/courseColors';
import type { AssignmentType, Priority } from '@/types/schedule';

const TYPE_ICON_PATH: Record<AssignmentType, string> = {
  assignment:
    'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  exam: 'M9 12l2 2 4-4m5 2a9 9 0 11-18 0 9 9 0 0118 0z',
  quiz: 'M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  project: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
  reading:
    'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
  other: 'M5 13l4 4L19 7',
};

export interface TaskRowProps {
  title: string;
  type?: AssignmentType;
  courseCode?: string;
  courseColor?: string;
  completed?: boolean;
  priority?: Priority;
  onToggleComplete?: () => void;
  /** Right-aligned custom content: due labels, badges, edit/delete links. */
  trailing?: ReactNode;
  /** When present, the row navigates to this URL on click (e.g. a task
   * detail page), while the checkbox stays independently clickable. */
  href?: string;
}

export function TaskRow({
  title,
  type = 'assignment',
  courseCode,
  courseColor,
  completed = false,
  priority = 'medium',
  onToggleComplete,
  trailing,
  href,
}: TaskRowProps) {
  // A bold, course-colored left edge is the row's primary "which class is
  // this" signal (Direction B), replacing the old small course-colored icon
  // badge - the type icon below is now plain/muted instead, so it doesn't
  // compete with the edge for color attention.
  const rowClass = cn(
    'flex items-center gap-3 py-2.5 pl-3 border-l-4 first:pt-0 last:pb-0',
    href && 'rounded-r-lg transition-colors hover:bg-accent',
  );

  const content = (
    <>
      {onToggleComplete && (
        <input
          type="checkbox"
          checked={completed}
          onChange={onToggleComplete}
          onClick={(e) => e.stopPropagation()}
          className="h-4 w-4 rounded border-border accent-primary shrink-0"
          aria-label={`Mark ${title} complete`}
        />
      )}
      <span className="flex h-6 w-6 shrink-0 items-center justify-center text-muted-foreground">
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.75}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d={TYPE_ICON_PATH[type]} />
        </svg>
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          {priority === 'high' && !completed && (
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
              title="High priority"
              aria-label="High priority"
            />
          )}
          <div
            className={cn(
              'text-sm font-medium truncate',
              completed ? 'text-muted-foreground line-through' : 'text-foreground',
            )}
          >
            {title}
          </div>
        </div>
        {courseCode && <div className="text-xs text-muted-foreground">{courseCode}</div>}
      </div>
      {trailing && (
        <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
          {trailing}
        </div>
      )}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={rowClass} style={courseBorderColor(courseColor)}>
        {content}
      </Link>
    );
  }

  return (
    <div className={rowClass} style={courseBorderColor(courseColor)}>
      {content}
    </div>
  );
}
