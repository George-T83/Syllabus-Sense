import { CardActionButton } from '@/components/ui/CardAction';
import { courseStanding } from '@/lib/academic/gradeMath';
import type { ScheduleItem } from '@/types/schedule';

export interface CourseStandingStripProps {
  /** The course's schedule items. */
  items: ScheduleItem[];
  onOpenCalculator: () => void;
}

/**
 * The number a student opens a course page for: their grade so far. Built
 * from their own graded work, with how much of the final grade that covers
 * - an 88% after one quiz and an 88% after the midterm aren't the same
 * news. Before any scores are in, it says how to get one; a course with no
 * grade weights at all shows nothing.
 */
export function CourseStandingStrip({ items, onOpenCalculator }: CourseStandingStripProps) {
  const standing = courseStanding(items);
  const hasWeights = items.some((i) => typeof i.gradeWeight === 'number' && i.gradeWeight > 0);
  if (!standing && !hasWeights) return null;

  if (!standing) {
    return (
      <p className="mt-4 border-t border-border pt-4 text-sm text-muted-foreground">
        No grades yet. Add your score to a finished task and your current grade shows up here.
      </p>
    );
  }

  const decided = Math.min(100, standing.decidedWeight);
  const ahead = Math.max(0, Math.round((100 - decided) * 10) / 10);

  return (
    <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-border pt-4">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
          Current grade
        </p>
        <p className="mt-0.5 flex items-baseline gap-2">
          <span className="font-display text-3xl font-medium tabular-nums tracking-tight text-foreground">
            {standing.percentage}%
          </span>
          <span className="text-lg font-semibold text-foreground">{standing.letter}</span>
        </p>
      </div>
      <div className="min-w-[12rem] flex-1">
        <p className="text-xs text-muted-foreground">
          From {standing.gradedCount} graded {standing.gradedCount === 1 ? 'item' : 'items'},{' '}
          {decided}% of your final grade.{' '}
          {ahead > 0 ? `${ahead}% is still ahead.` : 'Everything is graded.'}
        </p>
        <div aria-hidden="true" className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary" style={{ width: `${decided}%` }} />
        </div>
      </div>
      {ahead > 0 && (
        <CardActionButton withChevron onClick={onOpenCalculator}>
          What do I need?
        </CardActionButton>
      )}
    </div>
  );
}
