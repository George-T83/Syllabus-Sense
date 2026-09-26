'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { useAuth } from '@/context/AuthContext';
import { courseChipTint } from '@/lib/courseColors';
import {
  buildWeekBriefing,
  dueLabel,
  pointsMoveLabel,
  type BriefingItem,
} from '@/lib/dashboard/weekBriefing';
import { cn } from '@/lib/utils';
import type { Flashcard } from '@/types/flashcard';
import type { Course, ScheduleItem } from '@/types/schedule';

/** Rows shown before "+N more" - enough to plan a week, few enough to read. */
const VISIBLE_ROWS = 4;

/** Monday of the calendar week containing `date`, as a YYYY-MM-DD key - used
 * to dismiss the briefing "for the week" regardless of which day the
 * student first opens the dashboard on. */
function weekStartKey(date: Date): string {
  const d = new Date(date);
  const day = d.getDay(); // 0 = Sunday
  const diffToMonday = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diffToMonday);
  return d.toISOString().slice(0, 10);
}

function dismissedStorageKey(uid: string, weekKey: string): string {
  return `weekly-briefing-dismissed:${uid}:${weekKey}`;
}

function formatHours(hours: number): string {
  if (hours <= 0) return '';
  return hours < 1 ? `~${Math.round(hours * 60)}m` : `~${Math.round(hours * 10) / 10}h`;
}

function headlineFor(top: BriefingItem): { title: string; detail: string } {
  const code = top.course?.code ?? 'this course';
  const when = dueLabel(top.daysUntilDue, top.item.dueDate);
  const dueSentence =
    top.daysUntilDue < 0
      ? `It's ${when}`
      : `Due ${top.daysUntilDue <= 1 ? when.toLowerCase() : when}`;
  if (top.weight !== undefined) {
    const move = pointsMoveLabel(top.weight)!;
    return {
      title: `${top.daysUntilDue < 0 ? 'Catch up on' : 'Start with'} ${top.item.title}`,
      detail: `Worth ${top.weight}% of your ${code} grade. ${dueSentence}, and ${move}.`,
    };
  }
  return {
    title: `${top.daysUntilDue < 0 ? 'Catch up on' : 'Start with'} ${top.item.title}`,
    detail: `${dueSentence}. Add its grade weight to see how much it counts.`,
  };
}

function Readiness({ readiness }: { readiness: NonNullable<BriefingItem['readiness']> }) {
  const base =
    'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold transition-colors';
  if (readiness.cards === 0) {
    return (
      <Link
        href="/flashcards"
        className={cn(base, 'bg-muted text-muted-foreground hover:text-foreground')}
      >
        No flashcards yet
      </Link>
    );
  }
  if (readiness.dueCards === 0) {
    return (
      <Link href="/flashcards" className={cn(base, 'bg-load-low/10 text-load-low')}>
        Cards up to date
      </Link>
    );
  }
  return (
    <Link href="/flashcards" className={cn(base, 'bg-primary/10 text-primary hover:bg-primary/15')}>
      Review {readiness.dueCards} {readiness.dueCards === 1 ? 'card' : 'cards'}
    </Link>
  );
}

function BriefingRow({ entry, rank }: { entry: BriefingItem; rank: number }) {
  const { item, course, weight, daysUntilDue, hoursLeft, readiness } = entry;
  const tint = courseChipTint(course?.color);
  const overdue = daysUntilDue < 0;
  const hours = formatHours(hoursLeft);
  return (
    <li className="flex gap-3 py-3 first:pt-0 last:pb-0">
      <span
        aria-hidden="true"
        className={cn(
          'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-display text-sm',
          rank === 1 ? 'bg-gradient-brand text-white' : 'bg-muted text-muted-foreground',
        )}
      >
        {rank}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {course && (
            <span
              className={cn(
                'shrink-0 rounded-md border px-1.5 py-px text-[11px] font-semibold',
                tint.className,
              )}
              style={tint.style}
            >
              {course.code}
            </span>
          )}
          <Link
            href={`/tasks/${item.id}`}
            className="min-w-0 truncate text-sm font-semibold text-foreground hover:text-primary"
          >
            {item.title}
          </Link>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className={cn(overdue && 'font-semibold text-destructive')}>
            {dueLabel(daysUntilDue, item.dueDate)}
          </span>
          {hours && <span>{hours} left</span>}
          {readiness && <Readiness readiness={readiness} />}
        </div>
      </div>
      <div className="shrink-0 text-right">
        {weight !== undefined ? (
          <>
            <p className="font-display text-lg leading-none tabular-nums text-foreground">
              {weight}%
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">of grade</p>
          </>
        ) : (
          <p className="pt-0.5 text-[11px] text-muted-foreground">Weight not set</p>
        )}
      </div>
    </li>
  );
}

export interface WeeklyBriefingCardProps {
  /** The selected term's schedule items. */
  scheduleItems: ScheduleItem[];
  courses: Course[];
  flashcards: Flashcard[];
}

/**
 * What matters this week: the week's unfinished work ranked by how much of
 * a grade it decides, with what each point is worth, the hours left, and -
 * for exams and quizzes - whether the course's flashcards are ready.
 * Dismissing it hides it until the following week's Monday.
 */
export function WeeklyBriefingCard({
  scheduleItems,
  courses,
  flashcards,
}: WeeklyBriefingCardProps) {
  const { user } = useAuth();
  const weekKey = useMemo(() => weekStartKey(new Date()), []);
  const [dismissed, setDismissed] = useState(() => {
    if (!user || typeof window === 'undefined') return false;
    try {
      return window.localStorage.getItem(dismissedStorageKey(user.uid, weekKey)) === 'true';
    } catch {
      return false;
    }
  });

  const briefing = useMemo(
    () => buildWeekBriefing(scheduleItems, courses, flashcards),
    [scheduleItems, courses, flashcards],
  );

  if (dismissed || briefing.ranked.length === 0) return null;

  const top = briefing.ranked[0];
  const { title, detail } = headlineFor(top);
  const visible = briefing.ranked.slice(0, VISIBLE_ROWS);
  const more = briefing.ranked.length - visible.length;

  const summary = [
    `${briefing.ranked.length} ${briefing.ranked.length === 1 ? 'thing' : 'things'} due`,
    briefing.totalHours > 0 ? `${formatHours(briefing.totalHours)} of work` : null,
    briefing.examCount > 0
      ? `${briefing.examCount} ${briefing.examCount === 1 ? 'exam' : 'exams'}`
      : null,
    briefing.overdueCount > 0 ? `${briefing.overdueCount} overdue` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const handleDismiss = () => {
    setDismissed(true);
    if (!user) return;
    try {
      window.localStorage.setItem(dismissedStorageKey(user.uid, weekKey), 'true');
    } catch {
      // Non-fatal: worst case the briefing reappears next visit this week.
    }
  };

  return (
    <Card className="rounded-2xl p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
            What matters this week
          </p>
          <h2
            id="week-briefing-title"
            className="mt-1 font-display text-2xl font-medium tracking-tight text-foreground"
          >
            {title}
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{detail}</p>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss this week's briefing"
          className="shrink-0 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <ol aria-label="This week, biggest stakes first" className="mt-5 divide-y divide-border/70">
        {visible.map((entry, i) => (
          <BriefingRow key={entry.item.id} entry={entry} rank={i + 1} />
        ))}
      </ol>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border/70 pt-3 text-xs text-muted-foreground">
        <span>{summary}</span>
        {more > 0 && (
          <Link href="/tasks" className="font-medium hover:text-primary">
            +{more} more this week
          </Link>
        )}
      </div>
    </Card>
  );
}
