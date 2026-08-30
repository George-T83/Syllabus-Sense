'use client';

import { useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { TaskRow } from '@/components/ui/TaskRow';
import { WeekView } from '@/components/calendar/WeekView';
import { resolveActiveTerm, useAppState } from '@/context/AppStateContext';
import { useAuth } from '@/context/AuthContext';
import { updateScheduleItem } from '@/lib/firestore/scheduleItems';
import {
  addDays,
  addMonths,
  getMonthGrid,
  getWeekDays,
  groupItemsByDay,
  isSameDay,
  sortItemsByUrgency,
  toDayKey,
  parseDayKey,
  startOfDay,
} from '@/lib/calendar/dates';
import {
  formatTimeLabel,
  getMeetingsForDay,
  type MeetingOccurrence,
} from '@/lib/calendar/meetings';
import { cn } from '@/lib/utils';
import {
  calculateDailyLoad,
  getWorkloadLevel,
  WORKLOAD_LEVEL_LABELS,
  WORKLOAD_CHIP_CLASS,
  WORKLOAD_PREP_INDICATOR_CLASS,
  WORKLOAD_SWATCH_CLASS,
  WORKLOAD_TEXT_CLASS,
  WORKLOAD_TINT_CLASS,
} from '@/lib/workload';
import { buildICSFilename, createICSBlob, generateICS } from '@/lib/export/ics';
import { generateGoogleCalendarUrl, generateOutlookCalendarUrl } from '@/lib/export/calendarLinks';
import { courseChipTint, courseSwatch } from '@/lib/courseColors';
import { useModalA11y } from '@/hooks/useModalA11y';
import type { AssignmentType, Course, ScheduleItem, WorkloadLevel } from '@/types/schedule';

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const FULL_WEEKDAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];
const monthLabelFormatter = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' });
const dayLabelFormatter = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
});
const agendaDayLabelFormatter = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
});
const weekLabelFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });

/** Semantic icons for the calendar key (course chips / workload / markers),
 * replacing plain dots and squares so each row communicates what it means
 * at a glance instead of relying purely on color. Small enough to stay
 * inline rather than routing through the shared ICON_PATHS single-path
 * convention - graduation cap and workload bars both need multiple shapes. */
function GraduationCapIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 10L12 5 2 10l10 5 10-5z" />
      <path d="M6 12v5c0 1.5 2.7 3 6 3s6-1.5 6-3v-5" />
    </svg>
  );
}

function FlagIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 3v18M4 4h11l-2 4 2 4H4" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

/** Three ascending bars whose fill opacity encodes the workload level, so
 * severity reads even without relying on the color alone - low fills only
 * the first bar, critical fills all three at full strength. */
function WorkloadGaugeIcon({ level, className }: { level: WorkloadLevel; className?: string }) {
  const fill = {
    low: [1, 0.2, 0.2],
    medium: [1, 1, 0.2],
    high: [1, 1, 0.55],
    critical: [1, 1, 1],
  }[level];

  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <rect x="3" y="16" width="4" height="5" rx="1" opacity={fill[0]} />
      <rect x="10" y="11" width="4" height="10" rx="1" opacity={fill[1]} />
      <rect x="17" y="7" width="4" height="14" rx="1" opacity={fill[2]} />
    </svg>
  );
}

/** Small triangular alert glyph for the CA-4 "busiest stretch" callout -
 * distinct from the workload gauge (which encodes a *level*) since this
 * icon just needs to say "heads up", not grade a severity. */
function AlertIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      <path d="M12 9v4M12 17h.01" />
    </svg>
  );
}

function FilterIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 6h16M7 12h10M10 18h4" />
    </svg>
  );
}

function formatWeekRangeLabel(weekDays: Date[]): string {
  const start = weekDays[0];
  const end = weekDays[weekDays.length - 1];
  const sameMonth = start.getMonth() === end.getMonth();
  const startLabel = weekLabelFormatter.format(start);
  const endLabel = sameMonth ? String(end.getDate()) : weekLabelFormatter.format(end);
  return `${startLabel} – ${endLabel}, ${end.getFullYear()}`;
}

/** Compact "Sep 3 – 9" style range for the CA-4 busiest-stretch banner - no
 * year, since it's a single inline banner line rather than a page heading. */
function formatStretchRangeLabel(start: Date, end: Date): string {
  const sameMonth = start.getMonth() === end.getMonth();
  const startLabel = weekLabelFormatter.format(start);
  const endLabel = sameMonth ? String(end.getDate()) : weekLabelFormatter.format(end);
  return `${startLabel} – ${endLabel}`;
}

const MAX_VISIBLE_CHIPS = 2;
const AGENDA_WINDOW_DAYS = 30;
// #CA-4: width of the rolling window scanned for the term's busiest
// upcoming stretch - a week-long lens, since a single busy day is already
// covered by the per-month "Busiest" callout and a whole month is too
// coarse to act on.
const BUSY_STRETCH_WINDOW_DAYS = 7;

const LEGEND_LEVELS: WorkloadLevel[] = ['low', 'medium', 'high', 'critical'];

// #CA-3: on mobile-width chips there's only room for a handful of
// characters before truncation, so a shared title prefix ("Final...")
// collapses several different items to the same illegible fragment. Leading
// with the item's type instead keeps mobile chips distinguishable even
// fully truncated. Short and uppercase so it reads as a tag, not a
// truncated word.
const TYPE_MOBILE_LABEL: Record<AssignmentType, string> = {
  assignment: 'ASSIGN',
  exam: 'EXAM',
  quiz: 'QUIZ',
  project: 'PROJECT',
  reading: 'READING',
  other: 'OTHER',
};

function buildDayAriaLabel(
  day: Date,
  items: ScheduleItem[],
  meetings: MeetingOccurrence[],
  hours: number,
  heatLevel: WorkloadLevel,
): string {
  const dateStr = dayLabelFormatter.format(day);
  const parts: string[] = [dateStr];
  if (items.length > 0) {
    parts.push(`${items.length} ${items.length === 1 ? 'task' : 'tasks'}`);
  }
  if (meetings.length > 0) {
    parts.push(`${meetings.length} ${meetings.length === 1 ? 'class' : 'classes'}`);
  }
  if (hours > 0) {
    parts.push(`${hours.toFixed(1)}h load (${WORKLOAD_LEVEL_LABELS[heatLevel]})`);
  }
  return parts.join(', ');
}

type ViewMode = 'month' | 'week' | 'agenda';

export function MonthCalendar() {
  const { state, dispatch } = useAppState();
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [viewMonth, setViewMonth] = useState(() => startOfDay(new Date()));
  const [weekAnchor, setWeekAnchor] = useState(() => startOfDay(new Date()));
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [focusedDateKey, setFocusedDateKey] = useState<string | null>(null);
  const dayButtonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const [hiddenCourseIds, setHiddenCourseIds] = useState<Set<string>>(new Set());
  const [showCompleted, setShowCompleted] = useState(true);
  const [showClasses, setShowClasses] = useState(true);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const filterSheetRef = useModalA11y<HTMLDivElement>(filterSheetOpen, () =>
    setFilterSheetOpen(false),
  );
  const activeFilterCount = hiddenCourseIds.size + (showClasses ? 0 : 1) + (showCompleted ? 0 : 1);

  const today = useMemo(() => startOfDay(new Date()), []);
  const itemsByDay = useMemo(() => groupItemsByDay(state.scheduleItems), [state.scheduleItems]);
  const grid = useMemo(() => getMonthGrid(viewMonth), [viewMonth]);
  const weeks = useMemo(() => {
    const rows: Date[][] = [];
    for (let i = 0; i < grid.length; i += 7) {
      rows.push(grid.slice(i, i + 7));
    }
    return rows;
  }, [grid]);
  const weekDays = useMemo(() => getWeekDays(weekAnchor), [weekAnchor]);

  // The workload engine normalizes to UTC midnight internally (see
  // lib/workload/dateUtils.ts); constructing the reference date from local
  // Y/M/D components (rather than passing `today` straight through) keeps
  // that math aligned with the user's actual local calendar, matching the
  // same pattern used in computeSmartPlan.ts.
  const workloadReferenceDate = useMemo(
    () => new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())),
    [today],
  );
  const dailyLoad = useMemo(
    () => calculateDailyLoad(state.scheduleItems, workloadReferenceDate),
    [state.scheduleItems, workloadReferenceDate],
  );

  const courseOf = (item: ScheduleItem): Course | undefined =>
    state.courses.find((c) => c.id === item.courseId);

  // #101: recurring class meetings are inherently term-bound (a Fall 2026
  // MWF pattern shouldn't keep rendering forever into Spring 2027), so they
  // get scoped to the active term. Due-date items deliberately do NOT get
  // this treatment - a concrete deadline is real regardless of which term is
  // "selected" right now, so hiding it here could cause a missed assignment.
  const activeTerm = useMemo(
    () => resolveActiveTerm(state.selectedTerm, state.courses),
    [state.selectedTerm, state.courses],
  );
  const termScopedCourses = useMemo(
    () => (activeTerm ? state.courses.filter((c) => c.term === activeTerm) : state.courses),
    [state.courses, activeTerm],
  );

  const toggleCourseVisibility = (courseId: string) => {
    setHiddenCourseIds((prev) => {
      const next = new Set(prev);
      if (next.has(courseId)) next.delete(courseId);
      else next.add(courseId);
      return next;
    });
  };

  const visibleDayItems = (day: Date): ScheduleItem[] => {
    const items = itemsByDay.get(toDayKey(day)) ?? [];
    return items.filter(
      (item) => !hiddenCourseIds.has(item.courseId) && (showCompleted || !item.completed),
    );
  };

  const visibleMeetings = (day: Date): MeetingOccurrence[] => {
    if (!showClasses) return [];
    return getMeetingsForDay(termScopedCourses, day).filter(
      (m) => !hiddenCourseIds.has(m.course.id),
    );
  };

  // Monthly stats: pending load and the single busiest day, computed only
  // over cells that belong to the month actually being viewed (the grid pads
  // in adjacent-month days, which shouldn't skew "this month" numbers).
  const monthStats = useMemo(() => {
    let pendingCount = 0;
    let totalHours = 0;
    let busiestDay: { day: Date; hours: number } | null = null;

    for (const day of grid) {
      if (day.getMonth() !== viewMonth.getMonth()) continue;
      const items = itemsByDay.get(toDayKey(day)) ?? [];
      pendingCount += items.filter((i) => !i.completed).length;
      const hours = dailyLoad.get(toDayKey(day)) ?? 0;
      totalHours += hours;
      if (hours > 0 && (!busiestDay || hours > busiestDay.hours)) {
        busiestDay = { day, hours };
      }
    }
    return { pendingCount, totalHours, busiestDay };
  }, [grid, viewMonth, itemsByDay, dailyLoad]);

  // #CA-4: the term's genuinely busiest upcoming stretch, scanned across the
  // *entire* known dataset (dailyLoad already spans every course's items,
  // not just the visible month) rather than monthStats above, which is
  // deliberately scoped to whichever month is currently in view. A student
  // paging through August has no way to discover November is brutal without
  // this - that's the whole point of a workload-aware calendar over a plain
  // one. Slides a BUSY_STRETCH_WINDOW_DAYS window starting from today (never
  // the past - "upcoming") across every day that carries any load, and keeps
  // whichever window sums the most effective hours.
  const busiestStretch = useMemo(() => {
    let maxDate: Date | null = null;
    for (const key of Array.from(dailyLoad.keys())) {
      if ((dailyLoad.get(key) ?? 0) <= 0) continue;
      const [y, m, d] = key.split('-').map(Number);
      const day = new Date(y, m - 1, d);
      if (!maxDate || day > maxDate) maxDate = day;
    }
    if (!maxDate || maxDate < today) return null;

    let best: { start: Date; end: Date; hours: number } | null = null;
    for (let cursor = today; cursor <= maxDate; cursor = addDays(cursor, 1)) {
      let sum = 0;
      for (let i = 0; i < BUSY_STRETCH_WINDOW_DAYS; i++) {
        sum += dailyLoad.get(toDayKey(addDays(cursor, i))) ?? 0;
      }
      if (!best || sum > best.hours) {
        best = { start: cursor, end: addDays(cursor, BUSY_STRETCH_WINDOW_DAYS - 1), hours: sum };
      }
    }
    return best && best.hours > 0 ? best : null;
  }, [dailyLoad, today]);

  const handleToggleComplete = async (item: ScheduleItem) => {
    if (!user) return;
    await updateScheduleItem(user.uid, item, { ...item, completed: !item.completed }, dispatch);
  };

  // Exports every currently-visible (filter-respecting) item as a single
  // .ics file the user can import into Google Calendar, Outlook, Apple
  // Calendar, etc. - the built-but-previously-unwired export engine from
  // PR #119, now finally reachable from real UI.
  const handleExportICS = () => {
    const visibleItems = state.scheduleItems.filter(
      (item) => !hiddenCourseIds.has(item.courseId) && (showCompleted || !item.completed),
    );
    const ics = generateICS(visibleItems, state.courses, new Date());
    const blob = createICSBlob(ics);
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = buildICSFilename('syllabus-sense-calendar');
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  const selectDay = (day: Date) => {
    setSelectedDay(day);
    if (day.getMonth() !== viewMonth.getMonth() || day.getFullYear() !== viewMonth.getFullYear()) {
      setViewMonth(new Date(day.getFullYear(), day.getMonth(), 1));
    }
  };

  // Arrow-key day-to-day navigation once a day is focused/selected, matching
  // the WAI-ARIA roving-focus pattern across the 42 cells.
  const handleGridKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const current = selectedDay ?? (focusedDateKey ? parseDayKey(focusedDateKey) : today);
    let target: Date | null = null;

    if (e.key === 'ArrowRight') {
      target = addDays(current, 1);
    } else if (e.key === 'ArrowLeft') {
      target = addDays(current, -1);
    } else if (e.key === 'ArrowDown') {
      target = addDays(current, 7);
    } else if (e.key === 'ArrowUp') {
      target = addDays(current, -7);
    } else if (e.key === 'Home') {
      // First day of current week (Sunday)
      target = addDays(current, -current.getDay());
    } else if (e.key === 'End') {
      // Last day of current week (Saturday)
      target = addDays(current, 6 - current.getDay());
    } else if (e.key === 'PageUp') {
      target = addMonths(current, -1);
    } else if (e.key === 'PageDown') {
      target = addMonths(current, 1);
    }

    if (target) {
      e.preventDefault();
      const targetKey = toDayKey(target);
      setFocusedDateKey(targetKey);
      selectDay(target);
      setTimeout(() => {
        dayButtonRefs.current.get(targetKey)?.focus();
      }, 0);
    }
  };

  const agendaDays = useMemo(
    () => Array.from({ length: AGENDA_WINDOW_DAYS }, (_, i) => addDays(today, i)),
    [today],
  );

  return (
    <div className="max-w-5xl space-y-6 sm:space-y-8">
      <Card className="rounded-2xl p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <h2 className="text-lg font-bold tracking-tight text-foreground sm:text-xl">
            {viewMode === 'month' && monthLabelFormatter.format(viewMonth)}
            {viewMode === 'week' && formatWeekRangeLabel(weekDays)}
            {viewMode === 'agenda' && 'Next 30 days'}
          </h2>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <button
              onClick={handleExportICS}
              className="flex min-h-[44px] min-w-[44px] items-center justify-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground sm:px-3"
              title="Download visible items as a .ics file"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3"
                />
              </svg>
              <span className="hidden sm:inline">Export</span>
            </button>
            <div className="flex items-center rounded-lg border border-border p-0.5 text-xs font-medium">
              {(['month', 'week', 'agenda'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={cn(
                    'inline-flex min-h-[44px] items-center justify-center rounded-md px-3 py-1.5 capitalize transition-colors',
                    viewMode === mode
                      ? 'bg-primary font-semibold text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {mode}
                </button>
              ))}
            </div>
            {viewMode === 'month' && (
              <PeriodNav
                onPrev={() => setViewMonth((m) => addMonths(m, -1))}
                onToday={() => setViewMonth(startOfDay(new Date()))}
                onNext={() => setViewMonth((m) => addMonths(m, 1))}
                prevLabel="Previous month"
                nextLabel="Next month"
              />
            )}
            {viewMode === 'week' && (
              <PeriodNav
                onPrev={() => setWeekAnchor((d) => addDays(d, -7))}
                onToday={() => setWeekAnchor(startOfDay(new Date()))}
                onNext={() => setWeekAnchor((d) => addDays(d, 7))}
                prevLabel="Previous week"
                nextLabel="Next week"
              />
            )}
          </div>
        </div>

        {/* #CA-4: term-wide proactive heads-up, shown no matter which month/
            week is currently in view - the whole point is surfacing a busy
            stretch the student hasn't paged forward to see yet. */}
        {busiestStretch && (
          <button
            onClick={() => selectDay(busiestStretch.start)}
            className="mb-3 flex w-full items-center gap-2 rounded-xl border border-load-high/30 bg-load-high/10 px-3 py-2 text-left text-xs font-semibold text-foreground transition-colors hover:bg-load-high/15 sm:text-sm"
          >
            <AlertIcon className="h-4 w-4 shrink-0 text-load-high" />
            <span>
              Heads up: your busiest stretch this term is{' '}
              {formatStretchRangeLabel(busiestStretch.start, busiestStretch.end)} (
              {busiestStretch.hours.toFixed(1)}h)
            </span>
          </button>
        )}

        {state.courses.length > 0 && (
          <>
            {/* Desktop / tablet: bold inline chip row (Direction B) */}
            <div className="mb-3 hidden flex-wrap items-center gap-2 sm:flex">
              {state.courses.map((course) => {
                const hidden = hiddenCourseIds.has(course.id);
                const tint = courseChipTint(course.color);
                const swatch = courseSwatch(course.color);
                return (
                  <button
                    key={course.id}
                    onClick={() => toggleCourseVisibility(course.id)}
                    className={cn(
                      'flex min-h-[2.25rem] shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors',
                      hidden
                        ? 'border-border text-muted-foreground opacity-50'
                        : cn(tint.className, 'border-transparent hover:brightness-95'),
                    )}
                    style={hidden ? undefined : tint.style}
                  >
                    <span
                      className={cn('h-2.5 w-2.5 rounded-full', swatch.className)}
                      style={swatch.style}
                    />
                    {course.code}
                  </button>
                );
              })}
              <span className="mx-1 h-5 w-px shrink-0 bg-border" />
              <button
                onClick={() => setShowClasses((v) => !v)}
                className={cn(
                  'flex min-h-[2.25rem] shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors',
                  showClasses
                    ? 'border-border text-foreground hover:bg-accent'
                    : 'border-border text-muted-foreground opacity-50',
                )}
              >
                <GraduationCapIcon className="h-3.5 w-3.5" />
                Classes
              </button>
              <button
                onClick={() => setShowCompleted((v) => !v)}
                className={cn(
                  'flex min-h-[2.25rem] shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors',
                  showCompleted
                    ? 'border-border text-foreground hover:bg-accent'
                    : 'border-border text-muted-foreground opacity-50',
                )}
              >
                <CheckIcon className="h-3.5 w-3.5" />
                Completed
              </button>
            </div>

            {/* Mobile: single "Filters" trigger opening a bottom sheet (Direction B) */}
            <div className="mb-3 sm:hidden">
              <button
                onClick={() => setFilterSheetOpen(true)}
                className="flex min-h-[2.75rem] w-full items-center justify-center gap-2 rounded-xl bg-gradient-brand px-4 py-2.5 text-sm font-semibold text-white shadow-sm"
              >
                <FilterIcon className="h-4 w-4" />
                Filters
                {activeFilterCount > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-white/25 px-1.5 text-xs font-bold">
                    {activeFilterCount}
                  </span>
                )}
              </button>
            </div>
          </>
        )}

        {filterSheetOpen && (
          <div className="fixed inset-0 z-50 flex items-end sm:hidden">
            <div
              className="absolute inset-0 bg-background/80 backdrop-blur-sm"
              onClick={() => setFilterSheetOpen(false)}
            />
            <div
              ref={filterSheetRef}
              role="dialog"
              aria-modal="true"
              aria-label="Filters"
              className="relative z-10 flex max-h-[80vh] w-full flex-col rounded-t-2xl border-t border-border bg-card p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-modal"
            >
              <div className="mx-auto mb-3 h-1.5 w-10 shrink-0 rounded-full bg-border" />
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base font-bold text-foreground">Filters</h2>
                <button
                  onClick={() => setFilterSheetOpen(false)}
                  className="rounded-lg px-3 py-1.5 text-sm font-semibold text-primary hover:bg-accent"
                >
                  Done
                </button>
              </div>
              <div className="overflow-y-auto">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Courses
                </p>
                <div className="mb-4 flex flex-wrap gap-2">
                  {state.courses.map((course) => {
                    const hidden = hiddenCourseIds.has(course.id);
                    const tint = courseChipTint(course.color);
                    const swatch = courseSwatch(course.color);
                    return (
                      <button
                        key={course.id}
                        onClick={() => toggleCourseVisibility(course.id)}
                        className={cn(
                          'flex min-h-[2.75rem] shrink-0 items-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm font-semibold transition-colors',
                          hidden
                            ? 'border-border text-muted-foreground opacity-50'
                            : cn(tint.className, 'border-transparent'),
                        )}
                        style={hidden ? undefined : tint.style}
                      >
                        <span
                          className={cn('h-2.5 w-2.5 rounded-full', swatch.className)}
                          style={swatch.style}
                        />
                        {course.code}
                      </button>
                    );
                  })}
                </div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Show
                </p>
                <div className="mb-2 flex flex-wrap gap-2">
                  <button
                    onClick={() => setShowClasses((v) => !v)}
                    className={cn(
                      'flex min-h-[2.75rem] shrink-0 items-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm font-semibold transition-colors',
                      showClasses
                        ? 'border-border text-foreground hover:bg-accent'
                        : 'border-border text-muted-foreground opacity-50',
                    )}
                  >
                    <GraduationCapIcon className="h-4 w-4" />
                    Classes
                  </button>
                  <button
                    onClick={() => setShowCompleted((v) => !v)}
                    className={cn(
                      'flex min-h-[2.75rem] shrink-0 items-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm font-semibold transition-colors',
                      showCompleted
                        ? 'border-border text-foreground hover:bg-accent'
                        : 'border-border text-muted-foreground opacity-50',
                    )}
                  >
                    <CheckIcon className="h-4 w-4" />
                    Completed
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {viewMode === 'month' && (monthStats.pendingCount > 0 || monthStats.totalHours > 0) && (
          <div className="flex flex-wrap items-center gap-3 mb-4 rounded-xl bg-accent/50 px-3 py-2 text-xs">
            <span className="font-semibold text-foreground">
              {monthStats.pendingCount} due this month
            </span>
            <span className="text-muted-foreground">
              {monthStats.totalHours.toFixed(1)}h effective load
            </span>
            {monthStats.busiestDay && (
              <button
                onClick={() => selectDay(monthStats.busiestDay!.day)}
                className="ml-auto flex items-center gap-1.5 font-semibold text-primary hover:underline"
              >
                <span
                  className={cn(
                    'h-2 w-2 rounded-full',
                    WORKLOAD_SWATCH_CLASS[getWorkloadLevel(monthStats.busiestDay.hours)],
                  )}
                />
                Busiest: {monthStats.busiestDay.day.getDate()}{' '}
                {monthLabelFormatter.format(monthStats.busiestDay.day).split(' ')[0]}
              </button>
            )}
          </div>
        )}

        {viewMode === 'month' && (
          <>
            <div
              role="grid"
              aria-label={`Calendar ${monthLabelFormatter.format(viewMonth)}`}
              className="space-y-0.5 sm:space-y-1"
              onKeyDown={handleGridKeyDown}
            >
              <div role="row" className="grid grid-cols-7 gap-0.5 mb-1 sm:gap-1">
                {WEEKDAY_LABELS.map((label, idx) => (
                  <div
                    key={label}
                    role="columnheader"
                    aria-label={FULL_WEEKDAY_NAMES[idx]}
                    className="text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground py-1"
                  >
                    <span className="sm:hidden">{label.slice(0, 1)}</span>
                    <span className="hidden sm:inline">{label}</span>
                  </div>
                ))}
              </div>

              {weeks.map((week, weekIdx) => (
                <div key={weekIdx} role="row" className="grid grid-cols-7 gap-0.5 sm:gap-1">
                  {week.map((day) => {
                    const dayKey = toDayKey(day);
                    const dayItems = visibleDayItems(day);
                    const dayMeetings = visibleMeetings(day);
                    const inCurrentMonth = day.getMonth() === viewMonth.getMonth();
                    const isToday = isSameDay(day, today);
                    const isSelected = selectedDay !== null && isSameDay(day, selectedDay);
                    const hours = dailyLoad.get(dayKey) ?? 0;
                    const heatLevel = getWorkloadLevel(hours);
                    // #CA-1: only a day something is literally due/scheduled on
                    // gets the full "due here" tint. A day that merely picked up
                    // some of an item's spread-out prep-time load (from
                    // calculateDailyLoad distributing hours across the days
                    // leading up to a *different* day's due date) gets the
                    // quieter WORKLOAD_PREP_INDICATOR_CLASS treatment instead -
                    // otherwise the heatmap shades empty days and a student who
                    // clicks one expecting to see why stops trusting it.
                    const dueHere = dayItems.length > 0 || dayMeetings.length > 0;
                    const sortedItems = sortItemsByUrgency(dayItems, today);
                    const visibleChips = sortedItems.slice(0, MAX_VISIBLE_CHIPS);
                    const hiddenCount = sortedItems.length - visibleChips.length;
                    const isFocused =
                      focusedDateKey === dayKey ||
                      (!focusedDateKey && (isSelected || (selectedDay === null && isToday)));
                    const ariaLabel = buildDayAriaLabel(
                      day,
                      dayItems,
                      dayMeetings,
                      hours,
                      heatLevel,
                    );

                    return (
                      <button
                        key={day.toISOString()}
                        ref={(el) => {
                          if (el) dayButtonRefs.current.set(dayKey, el);
                          else dayButtonRefs.current.delete(dayKey);
                        }}
                        role="gridcell"
                        aria-selected={isSelected}
                        aria-label={ariaLabel}
                        tabIndex={isFocused ? 0 : -1}
                        onClick={() => {
                          setFocusedDateKey(dayKey);
                          selectDay(day);
                        }}
                        className={cn(
                          'min-h-[4rem] rounded-lg p-1 flex flex-col items-start gap-0.5 text-left transition-colors sm:min-h-[6.5rem] sm:rounded-xl sm:p-1.5 sm:gap-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                          inCurrentMonth ? 'hover:bg-accent' : 'opacity-40 hover:bg-accent/50',
                          isSelected && 'ring-2 ring-primary',
                          !isSelected &&
                            inCurrentMonth &&
                            (dueHere
                              ? WORKLOAD_TINT_CLASS[heatLevel]
                              : WORKLOAD_PREP_INDICATOR_CLASS[heatLevel]),
                        )}
                      >
                        <span
                          className={cn(
                            'flex h-5 w-5 items-center justify-center rounded-full text-[10px] sm:h-6 sm:w-6 sm:text-xs',
                            isToday
                              ? 'bg-gradient-brand font-bold text-white shadow-card'
                              : 'text-foreground',
                          )}
                        >
                          {day.getDate()}
                        </span>

                        {dayMeetings.length > 0 && (
                          <div className="flex w-full flex-wrap gap-0.5">
                            {dayMeetings.slice(0, 6).map((m, i) => (
                              <span
                                key={`${m.course.id}-${i}`}
                                className={cn(
                                  'flex h-3 w-3 shrink-0 items-center justify-center rounded-[3px] text-white',
                                  courseSwatch(m.course.color).className,
                                )}
                                style={courseSwatch(m.course.color).style}
                                title={`${m.course.code} · ${formatTimeLabel(m.meeting.startTime)}`}
                              >
                                <GraduationCapIcon className="h-2 w-2" />
                              </span>
                            ))}
                          </div>
                        )}

                        <div className="flex w-full flex-col gap-0.5">
                          {visibleChips.map((item) => (
                            <span
                              key={item.id}
                              className={cn(
                                'flex w-full min-w-0 items-center gap-0.5 overflow-hidden rounded px-1 py-0.5 text-[9px] font-medium leading-tight text-white',
                                courseSwatch(courseOf(item)?.color).className,
                                item.completed && 'opacity-40 line-through',
                              )}
                              style={courseSwatch(courseOf(item)?.color).style}
                              title={item.title}
                            >
                              {/* Hidden below sm: at mobile chip widths every
                                  pixel goes to the type label (CA-3) - the icon
                                  still fulfills the legend's promise (CA-2) at
                                  sm+, where there's room for both. */}
                              <FlagIcon className="hidden h-2 w-2 shrink-0 sm:block" />
                              {/* #CA-3: mobile-width chips only fit a handful of
                                  characters, so several similarly-titled items
                                  ("Final Exam"/"Final Project"/...) all truncate
                                  to the same illegible "Fina…". Leading with the
                                  type keeps them distinguishable; the full title
                                  is still shown at sm+ and always in the
                                  day-detail panel below. */}
                              <span className="min-w-0 truncate sm:hidden">
                                {TYPE_MOBILE_LABEL[item.type]}
                              </span>
                              <span className="hidden min-w-0 truncate sm:inline">
                                {item.title}
                              </span>
                            </span>
                          ))}
                          {hiddenCount > 0 && (
                            <span className="text-[9px] font-semibold leading-none text-muted-foreground">
                              +{hiddenCount} more
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>

            <div className="mt-4 space-y-2.5 border-t border-border pt-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="w-20 shrink-0 text-xs font-semibold text-foreground">
                  Workload
                </span>
                {LEGEND_LEVELS.map((level) => (
                  <span
                    key={level}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium',
                      WORKLOAD_CHIP_CLASS[level],
                      WORKLOAD_TEXT_CLASS[level],
                    )}
                  >
                    <WorkloadGaugeIcon level={level} className="h-3 w-3" />
                    {WORKLOAD_LEVEL_LABELS[level]}
                  </span>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="w-20 shrink-0 text-xs font-semibold text-foreground">Markers</span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-xs font-medium text-foreground">
                  <GraduationCapIcon className="h-3 w-3 shrink-0" />
                  Class session
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-xs font-medium text-foreground">
                  <FlagIcon className="h-3 w-3 shrink-0" />
                  Due item
                </span>
              </div>
            </div>
          </>
        )}

        {viewMode === 'week' && (
          <WeekView
            weekDays={weekDays}
            today={today}
            selectedDay={selectedDay}
            onSelectDay={selectDay}
            itemsFor={visibleDayItems}
            meetingsFor={visibleMeetings}
            courseOf={courseOf}
            dailyLoad={dailyLoad}
          />
        )}

        {viewMode === 'agenda' && (
          <div className="max-h-[32rem] space-y-1 overflow-y-auto pr-1">
            {agendaDays.map((day) => {
              const dayItems = visibleDayItems(day);
              const dayMeetings = visibleMeetings(day);
              if (dayItems.length === 0 && dayMeetings.length === 0) return null;
              const isToday = isSameDay(day, today);
              return (
                <div key={day.toISOString()} className="flex gap-3 py-2">
                  <div className="w-20 shrink-0 pt-0.5">
                    <span
                      className={cn(
                        'text-xs font-semibold',
                        isToday ? 'text-primary' : 'text-foreground',
                      )}
                    >
                      {isToday ? 'Today' : agendaDayLabelFormatter.format(day)}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1 space-y-1.5">
                    {dayMeetings.map((m, i) => (
                      <div key={`${m.course.id}-${i}`} className="flex items-center gap-2 text-sm">
                        <span
                          className={cn(
                            'h-2 w-2 shrink-0 rounded-[2px]',
                            courseSwatch(m.course.color).className,
                          )}
                          style={courseSwatch(m.course.color).style}
                        />
                        <span className="text-muted-foreground">
                          {formatTimeLabel(m.meeting.startTime)}
                        </span>
                        <span className="truncate text-foreground">{m.course.code} class</span>
                      </div>
                    ))}
                    {dayItems.map((item) => {
                      const course = courseOf(item);
                      return (
                        <TaskRow
                          key={item.id}
                          variant={state.preferences.taskRowVariant}
                          title={item.title}
                          href={`/tasks/${item.id}`}
                          type={item.type}
                          courseCode={course ? course.code : 'General'}
                          courseColor={course?.color}
                          courseIcon={course?.icon}
                          completed={item.completed}
                          progress={item.progress}
                          priority={item.priority}
                          onToggleComplete={user ? () => handleToggleComplete(item) : undefined}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {(viewMode === 'month' || viewMode === 'week') && selectedDay && (
        <DayDetailCard
          day={selectedDay}
          meetings={visibleMeetings(selectedDay)}
          items={visibleDayItems(selectedDay)}
          courseOf={courseOf}
          onToggleComplete={user ? handleToggleComplete : undefined}
        />
      )}
    </div>
  );
}

/** Grouped prev/Today/next control, styled as one segmented pill to match the
 * Export button and the Month/Week/Agenda switcher instead of three loose,
 * differently-weighted controls floating in the header. */
function PeriodNav({
  onPrev,
  onToday,
  onNext,
  prevLabel,
  nextLabel,
}: {
  onPrev: () => void;
  onToday: () => void;
  onNext: () => void;
  prevLabel: string;
  nextLabel: string;
}) {
  return (
    <div className="flex items-center gap-0.5 rounded-lg border border-border p-0.5">
      <button
        onClick={onPrev}
        aria-label={prevLabel}
        className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <button
        onClick={onToday}
        className="inline-flex min-h-[44px] items-center justify-center rounded-md px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-primary hover:text-primary-foreground"
      >
        Today
      </button>
      <button
        onClick={onNext}
        aria-label={nextLabel}
        className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  );
}

function DayDetailCard({
  day,
  meetings,
  items,
  courseOf,
  onToggleComplete,
}: {
  day: Date;
  meetings: MeetingOccurrence[];
  items: ScheduleItem[];
  courseOf: (item: ScheduleItem) => Course | undefined;
  onToggleComplete?: (item: ScheduleItem) => void;
}) {
  const { state } = useAppState();

  return (
    <Card className="rounded-2xl p-6">
      <h3 className="text-base font-semibold text-foreground mb-3">
        {dayLabelFormatter.format(day)}
      </h3>

      {meetings.length === 0 && items.length === 0 ? (
        <EmptyState
          icon={
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          }
          title="Nothing on this day"
          description="No classes and nothing due — enjoy the breathing room."
        />
      ) : (
        <div className="space-y-4">
          {meetings.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                Classes
              </h4>
              <div className="divide-y divide-border">
                {meetings.map((m, i) => (
                  <div key={`${m.course.id}-${i}`} className="flex items-center gap-3 py-2">
                    <span
                      className={cn(
                        'h-7 w-7 shrink-0 rounded-lg',
                        courseSwatch(m.course.color).className,
                      )}
                      style={courseSwatch(m.course.color).style}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-foreground truncate">
                        {m.course.code}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatTimeLabel(m.meeting.startTime)} –{' '}
                        {formatTimeLabel(m.meeting.endTime)}
                        {m.meeting.location ? ` · ${m.meeting.location}` : ''}
                      </div>
                    </div>
                    {m.course.modality && (
                      <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-[10px] font-medium capitalize text-muted-foreground">
                        {m.course.modality}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {items.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                Due
              </h4>
              <div className="flex flex-col gap-2">
                {items.map((item) => {
                  const course = courseOf(item);
                  return (
                    <TaskRow
                      key={item.id}
                      variant={state.preferences.taskRowVariant}
                      title={item.title}
                      href={`/tasks/${item.id}`}
                      type={item.type}
                      courseCode={course ? course.code : 'General'}
                      courseColor={course?.color}
                      courseIcon={course?.icon}
                      completed={item.completed}
                      progress={item.progress}
                      priority={item.priority}
                      onToggleComplete={onToggleComplete ? () => onToggleComplete(item) : undefined}
                      trailing={
                        <div className="flex items-center gap-1">
                          {/* <button>, not <a href>: this trailing content
                              renders inside the row's own <Link> (the row
                              itself navigates to the task on click) - an
                              <a> nested inside an <a> is invalid HTML and
                              gets silently unnested by the browser's parser,
                              breaking both links' click targets. */}
                          <button
                            type="button"
                            onClick={() =>
                              window.open(
                                generateGoogleCalendarUrl(item, course),
                                '_blank',
                                'noopener,noreferrer',
                              )
                            }
                            title="Add to Google Calendar"
                            className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                          >
                            <svg
                              className="h-3.5 w-3.5"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M12 4v16m8-8H4"
                              />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              window.open(
                                generateOutlookCalendarUrl(item, course),
                                '_blank',
                                'noopener,noreferrer',
                              )
                            }
                            title="Add to Outlook"
                            className="rounded-md p-1 text-[9px] font-bold text-muted-foreground hover:bg-accent hover:text-foreground"
                          >
                            O
                          </button>
                        </div>
                      }
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
