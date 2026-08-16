import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
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

/** Priority is intentionally styled separately from workload-level color
 * (load-low/medium/high/critical) so "how urgent I marked this" never gets
 * visually confused with "how much cognitive load this actually is." */
const PRIORITY_BORDER_CLASS: Record<Priority, string> = {
  high: 'border-l-primary',
  medium: 'border-l-border',
  low: 'border-l-transparent',
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
}: TaskRowProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 py-2.5 pl-3 border-l-2 first:pt-0 last:pb-0',
        PRIORITY_BORDER_CLASS[priority],
      )}
    >
      {onToggleComplete && (
        <input
          type="checkbox"
          checked={completed}
          onChange={onToggleComplete}
          className="h-4 w-4 rounded border-border accent-primary shrink-0"
          aria-label={`Mark ${title} complete`}
        />
      )}
      <span
        className={cn(
          'h-7 w-7 rounded-lg flex items-center justify-center shrink-0 text-white',
          courseColor || 'bg-primary',
        )}
      >
        <svg
          className="h-3.5 w-3.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d={TYPE_ICON_PATH[type]} />
        </svg>
      </span>
      <div className="min-w-0 flex-1">
        <div
          className={cn(
            'text-sm font-medium truncate',
            completed ? 'text-muted-foreground line-through' : 'text-foreground',
          )}
        >
          {title}
        </div>
        {courseCode && <div className="text-xs text-muted-foreground">{courseCode}</div>}
      </div>
      {trailing && <div className="flex items-center gap-2 shrink-0">{trailing}</div>}
    </div>
  );
}
