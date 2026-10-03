'use client';

import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { CardActionButton, CardActionLink, SyllabusIcon } from '@/components/ui/CardAction';
import { courseChipTint } from '@/lib/courseColors';
import { dispatchFocusTask } from '@/lib/focus/focusTaskEvent';
import { dueLabel, pointsMoveLabel } from '@/lib/dashboard/weekBriefing';
import type { NowHero } from '@/lib/dashboard/nowHero';
import { cn } from '@/lib/utils';

function formatHours(hours: number): string {
  if (hours <= 0) return '';
  return hours < 1 ? `~${Math.round(hours * 60)}m` : `~${Math.round(hours * 10) / 10}h`;
}

export interface NowHeroCardProps {
  hero: NowHero;
  /** Marks the hero task done; omitted when signed out. */
  onMarkDone?: (itemId: string) => void;
  onUploadSyllabus: () => void;
  onAddTask: () => void;
}

/**
 * The one thing to do next, as the first block under the greeting. Replaces
 * the old gradient "Autofill from Syllabus" banner as the dominant call to
 * action: that banner now only leads when there is nothing else to do.
 */
export function NowHeroCard({ hero, onMarkDone, onUploadSyllabus, onAddTask }: NowHeroCardProps) {
  if (hero.kind === 'clear') {
    return (
      <Card data-testid="now-hero" accent="left" className="rounded-2xl p-5 sm:p-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
          All clear
        </p>
        <h2 className="mt-1 font-display text-2xl font-medium tracking-tight text-foreground sm:text-3xl">
          Nothing needs you right now
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          {hero.upcoming
            ? `Next up is ${hero.upcoming.title}, due ${new Intl.DateTimeFormat('en-US', {
                month: 'short',
                day: 'numeric',
              }).format(new Date(hero.upcoming.dueDate))}. Got another syllabus to add?`
            : 'No deadlines on the horizon. Got a syllabus? The AI Advisor can set it up for you.'}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <CardActionButton variant="primary" onClick={onUploadSyllabus}>
            <SyllabusIcon />
            Autofill from Syllabus
          </CardActionButton>
          <CardActionButton variant="ghost" withPlus onClick={onAddTask}>
            Add a task
          </CardActionButton>
        </div>
      </Card>
    );
  }

  if (hero.kind === 'cards') {
    return (
      <Card data-testid="now-hero" accent="left" className="rounded-2xl p-5 sm:p-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
          Review time
        </p>
        <h2 className="mt-1 font-display text-2xl font-medium tracking-tight text-foreground sm:text-3xl">
          Review {hero.dueCards} {hero.dueCards === 1 ? 'card' : 'cards'}
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          No deadlines this week. A few minutes of review keeps what you have learned fresh.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <CardActionLink href="/flashcards" variant="primary" withChevron>
            Start reviewing
          </CardActionLink>
        </div>
      </Card>
    );
  }

  const { entry } = hero;
  const { item, course, weight, daysUntilDue, hoursLeft } = entry;
  const tint = courseChipTint(course?.color);
  const urgent = hero.kind === 'urgent';
  const hours = formatHours(hoursLeft);
  const move = pointsMoveLabel(weight);
  const when = dueLabel(daysUntilDue, item.dueDate);

  return (
    <Card
      data-testid="now-hero"
      accent="left"
      className={cn('rounded-2xl p-5 sm:p-6', urgent && 'border-l-destructive')}
    >
      <p
        className={cn(
          'text-[11px] font-semibold uppercase tracking-[0.2em]',
          urgent ? 'text-destructive' : 'text-primary',
        )}
      >
        {urgent ? 'Do this now' : 'Next up'}
      </p>
      <h2 className="mt-1 font-display text-2xl font-medium tracking-tight text-foreground sm:text-3xl">
        {item.title}
      </h2>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-muted-foreground">
        {course && (
          <span
            className={cn('rounded-md border px-1.5 py-px text-xs font-semibold', tint.className)}
            style={tint.style}
          >
            {course.code}
          </span>
        )}
        <span className={cn(daysUntilDue <= 0 && 'font-semibold text-destructive')}>{when}</span>
        {hours && <span>{hours} left</span>}
        {weight !== undefined && <span>{weight}% of your grade</span>}
      </div>
      {move && (
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          {move.charAt(0).toUpperCase() + move.slice(1)}.
        </p>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <CardActionButton variant="primary" onClick={() => dispatchFocusTask(item.id)}>
          Start a focus session
        </CardActionButton>
        <CardActionLink href={`/tasks/${item.id}`} variant="ghost" withChevron>
          Open task
        </CardActionLink>
        {onMarkDone && (
          <CardActionButton variant="solid" onClick={() => onMarkDone(item.id)}>
            Mark done
          </CardActionButton>
        )}
        {hero.others > 0 && (
          <Link
            href="/tasks"
            className="ml-auto text-xs font-medium text-muted-foreground hover:text-primary"
          >
            +{hero.others} more this week
          </Link>
        )}
      </div>
    </Card>
  );
}
