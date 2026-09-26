import { categoryCourseBlocks, type CategoryProgress } from '@/lib/degreeCompass/progress';
import type { DegreeCourse } from '@/types/degreeCompass';
import { cn } from '@/lib/utils';

const BLOCK_CLASS: Record<DegreeCourse['status'], string> = {
  completed: 'bg-primary',
  'in-progress': 'bg-primary/45',
  planned: 'border border-dashed border-primary/70 bg-transparent',
};

const STATUS_WORD: Record<DegreeCourse['status'], string> = {
  completed: 'completed',
  'in-progress': 'in progress',
  planned: 'planned',
};

/**
 * One requirement as the courses that fill it: a block per course, sized by
 * credits (solid when completed, lighter in progress, dashed when planned),
 * then the credits no course covers yet - with a plain line saying what's
 * left and whether the plan covers it.
 */
export function CategoryProgressBar({
  progress,
  courses,
}: {
  progress: CategoryProgress;
  courses: DegreeCourse[];
}) {
  const { category, creditsCompleted, creditsInProgress } = progress;
  const { blocks, creditsLeft, creditsUnplanned } = categoryCourseBlocks(category, courses);
  const earned = creditsCompleted + creditsInProgress;
  const onPlan = blocks.reduce((sum, c) => sum + c.credits, 0);
  const uncovered = Math.max(0, category.creditsRequired - onPlan);

  const status =
    creditsLeft === 0
      ? 'Requirement met'
      : creditsUnplanned === 0
        ? `${creditsLeft} cr left, all planned`
        : creditsUnplanned === creditsLeft
          ? `${creditsLeft} cr left, none planned yet`
          : `${creditsLeft} cr left, ${creditsUnplanned} not planned yet`;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="font-medium text-foreground">{category.name}</span>
        <span className="shrink-0 tabular-nums text-muted-foreground">
          {earned} / {category.creditsRequired} cr
        </span>
      </div>
      <div
        className="flex h-3 w-full gap-[2px] overflow-hidden rounded-full bg-muted"
        role="img"
        aria-label={`${category.name}: ${blocks
          .map((c) => `${c.code} ${c.credits} credits ${STATUS_WORD[c.status]}`)
          .join(', ')}${blocks.length ? '. ' : ''}${status}.`}
      >
        {blocks.map((c) => (
          <div
            key={c.id}
            title={`${c.code} · ${c.credits} cr · ${STATUS_WORD[c.status]}`}
            className={cn('h-full first:rounded-l-full', BLOCK_CLASS[c.status])}
            style={{ flex: `${c.credits} 0 0` }}
          />
        ))}
        {uncovered > 0 && <div className="h-full" style={{ flex: `${uncovered} 0 0` }} />}
      </div>
      <p
        className={cn(
          'text-[11px]',
          creditsLeft === 0
            ? 'text-load-low'
            : creditsUnplanned > 0
              ? 'text-load-medium'
              : 'text-muted-foreground',
        )}
      >
        {status}
      </p>
    </div>
  );
}
