'use client';

import { useMemo, useState, type KeyboardEvent } from 'react';
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
  toDayKey,
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
  WORKLOAD_SWATCH_CLASS,
  WORKLOAD_TINT_CLASS,
} from '@/lib/workload';
import { buildICSFilename, createICSBlob, generateICS } from '@/lib/export/ics';
import { generateGoogleCalendarUrl, generateOutlookCalendarUrl } from '@/lib/export/calendarLinks';
import type { Course, ScheduleItem, WorkloadLevel } from '@/types/schedule';

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
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

function formatWeekRangeLabel(weekDays: Date[]): string {
  const start = weekDays[0];
  const end = weekDays[weekDays.length - 1];
  const sameMonth = start.getMonth() === end.getMonth();
  const startLabel = weekLabelFormatter.format(start);
  const endLabel = sameMonth ? String(end.getDate()) : weekLabelFormatter.format(end);
  return `${startLabel} – ${endLabel}, ${end.getFullYear()}`;
}

const MAX_VISIBLE_CHIPS = 2;
const AGENDA_WINDOW_DAYS = 30;

const LEGEND_LEVELS: WorkloadLevel[] = ['low', 'medium', 'high', 'critical'];

type ViewMode = 'month' | 'week' | 'agenda';

export function MonthCalendar() {
  const { state, dispatch } = useAppState();
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [viewMonth, setViewMonth] = useState(() => startOfDay(new Date()));
  const [weekAnchor, setWeekAnchor] = useState(() => startOfDay(new Date()));
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [hiddenCourseIds, setHiddenCourseIds] = useState<Set<string>>(new Set());
  const [showCompleted, setShowCompleted] = useState(true);
  const [showClasses, setShowClasses] = useState(true);

  const today = useMemo(() => startOfDay(new Date()), []);
  const itemsByDay = useMemo(() => groupItemsByDay(state.scheduleItems), [state.scheduleItems]);
  const grid = useMemo(() => getMonthGrid(viewMonth), [viewMonth]);
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

  const courseOf = (item: ScheduleItem) => state.courses.find((c) => c.id === item.courseId);
  const courseColor = (item: ScheduleItem) => courseOf(item)?.color || 'bg-primary';

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
  // the roving-focus pattern real calendar widgets (Google Calendar,
  // react-day-picker) use instead of forcing tab-through-42-cells.
  const handleGridKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!selectedDay) return;
    const deltaByKey: Record<string, number> = {
      ArrowRight: 1,
      ArrowLeft: -1,
      ArrowDown: 7,
      ArrowUp: -7,
    };
    const delta = deltaByKey[e.key];
    if (delta === undefined) return;
    e.preventDefault();
    selectDay(addDays(selectedDay, delta));
  };

  const agendaDays = useMemo(
    () => Array.from({ length: AGENDA_WINDOW_DAYS }, (_, i) => addDays(today, i)),
    [today],
  );

  return (
    <div className="space-y-4">
      <Card className="rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold tracking-tight text-foreground">
            {viewMode === 'month' && monthLabelFormatter.format(viewMonth)}
            {viewMode === 'week' && formatWeekRangeLabel(weekDays)}
            {viewMode === 'agenda' && 'Next 30 days'}
          </h2>
          <div className="flex items-center gap-3">
            <button
              onClick={handleExportICS}
              className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              title="Download visible items as a .ics file"
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
                  d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3"
                />
              </svg>
              Export
            </button>
            <div className="flex items-center rounded-lg border border-border p-0.5 text-xs font-medium">
              {(['month', 'week', 'agenda'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={cn(
                    'rounded-md px-2.5 py-1 capitalize transition-colors',
                    viewMode === mode
                      ? 'bg-primary text-primary-foreground'
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

        {state.courses.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 mb-3">
            {state.courses.map((course) => {
              const hidden = hiddenCourseIds.has(course.id);
              return (
                <button
                  key={course.id}
                  onClick={() => toggleCourseVisibility(course.id)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
                    hidden
                      ? 'border-border text-muted-foreground opacity-50'
                      : 'border-border text-foreground hover:bg-accent',
                  )}
                >
                  <span className={cn('h-2 w-2 rounded-full', course.color || 'bg-primary')} />
                  {course.code}
                </button>
              );
            })}
            <span className="mx-1 h-4 w-px bg-border" />
            <button
              onClick={() => setShowClasses((v) => !v)}
              className={cn(
                'rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
                showClasses
                  ? 'border-border text-foreground hover:bg-accent'
                  : 'border-border text-muted-foreground opacity-50',
              )}
            >
              Classes
            </button>
            <button
              onClick={() => setShowCompleted((v) => !v)}
              className={cn(
                'rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
                showCompleted
                  ? 'border-border text-foreground hover:bg-accent'
                  : 'border-border text-muted-foreground opacity-50',
              )}
            >
              Completed
            </button>
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
            <div className="grid grid-cols-7 gap-1 mb-1">
              {WEEKDAY_LABELS.map((label) => (
                <div
                  key={label}
                  className="text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground py-1"
                >
                  {label}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1" onKeyDown={handleGridKeyDown}>
              {grid.map((day) => {
                const dayItems = visibleDayItems(day);
                const dayMeetings = visibleMeetings(day);
                const inCurrentMonth = day.getMonth() === viewMonth.getMonth();
                const isToday = isSameDay(day, today);
                const isSelected = selectedDay !== null && isSameDay(day, selectedDay);
                const hours = dailyLoad.get(toDayKey(day)) ?? 0;
                const heatLevel = getWorkloadLevel(hours);
                const visibleChips = dayItems.slice(0, MAX_VISIBLE_CHIPS);
                const hiddenCount = dayItems.length - visibleChips.length;

                return (
                  <button
                    key={day.toISOString()}
                    onClick={() => selectDay(day)}
                    className={cn(
                      'min-h-[6.5rem] rounded-xl p-1.5 flex flex-col items-start gap-1 text-left transition-colors',
                      inCurrentMonth ? 'hover:bg-accent' : 'opacity-40 hover:bg-accent/50',
                      isSelected && 'ring-2 ring-primary',
                      !isSelected && inCurrentMonth && WORKLOAD_TINT_CLASS[heatLevel],
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-6 w-6 items-center justify-center rounded-full text-xs',
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
                              'h-1.5 w-1.5 rounded-[2px]',
                              m.course.color || 'bg-primary',
                            )}
                            title={`${m.course.code} · ${formatTimeLabel(m.meeting.startTime)}`}
                          />
                        ))}
                      </div>
                    )}

                    <div className="flex w-full flex-col gap-0.5">
                      {visibleChips.map((item) => (
                        <span
                          key={item.id}
                          className={cn(
                            'block w-full truncate rounded px-1 py-0.5 text-[9px] font-medium leading-tight text-white',
                            courseColor(item),
                            item.completed && 'opacity-40 line-through',
                          )}
                          title={item.title}
                        >
                          {item.title}
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

            <div className="mt-4 space-y-2.5 border-t border-border pt-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="w-20 shrink-0 text-xs font-semibold text-foreground">
                  Workload
                </span>
                {LEGEND_LEVELS.map((level) => (
                  <span
                    key={level}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium text-foreground',
                      WORKLOAD_CHIP_CLASS[level],
                    )}
                  >
                    <span
                      className={cn('h-2.5 w-2.5 rounded-full', WORKLOAD_SWATCH_CLASS[level])}
                    />
                    {WORKLOAD_LEVEL_LABELS[level]}
                  </span>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="w-20 shrink-0 text-xs font-semibold text-foreground">Markers</span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-xs font-medium text-foreground">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-[2px] bg-primary" />
                  Class session
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-xs font-medium text-foreground">
                  <span className="h-2.5 w-4 shrink-0 rounded bg-primary" />
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
                            m.course.color || 'bg-primary',
                          )}
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
                          title={item.title}
                          href={`/tasks/${item.id}`}
                          type={item.type}
                          courseCode={course ? course.code : 'General'}
                          courseColor={course?.color}
                          completed={item.completed}
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
        className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <svg
          className="h-3.5 w-3.5"
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
        className="rounded-md px-2.5 py-1 text-xs font-semibold text-foreground transition-colors hover:bg-primary hover:text-primary-foreground"
      >
        Today
      </button>
      <button
        onClick={onNext}
        aria-label={nextLabel}
        className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <svg
          className="h-3.5 w-3.5"
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
                      className={cn('h-7 w-7 shrink-0 rounded-lg', m.course.color || 'bg-primary')}
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
              <div className="divide-y divide-border">
                {items.map((item) => {
                  const course = courseOf(item);
                  return (
                    <TaskRow
                      key={item.id}
                      title={item.title}
                      href={`/tasks/${item.id}`}
                      type={item.type}
                      courseCode={course ? course.code : 'General'}
                      courseColor={course?.color}
                      completed={item.completed}
                      priority={item.priority}
                      onToggleComplete={onToggleComplete ? () => onToggleComplete(item) : undefined}
                      trailing={
                        <div className="flex items-center gap-1">
                          <a
                            href={generateGoogleCalendarUrl(item, course)}
                            target="_blank"
                            rel="noopener noreferrer"
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
                          </a>
                          <a
                            href={generateOutlookCalendarUrl(item, course)}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Add to Outlook"
                            className="rounded-md p-1 text-[9px] font-bold text-muted-foreground hover:bg-accent hover:text-foreground"
                          >
                            O
                          </a>
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
