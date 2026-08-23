'use client';

import { useEffect, useRef } from 'react';
import { isSameDay, sortItemsByUrgency, toDayKey } from '@/lib/calendar/dates';
import {
  formatTimeLabel,
  timeToFractionalHours,
  type MeetingOccurrence,
} from '@/lib/calendar/meetings';
import { cn } from '@/lib/utils';
import { getWorkloadLevel } from '@/lib/workload';
import { courseSwatch } from '@/lib/courseColors';
import type { AssignmentType, Course, ScheduleItem, WorkloadLevel } from '@/types/schedule';

// #CA-3: same short, uppercase, mobile-lead labels MonthCalendar uses for
// its day-cell chips - kept in sync so a truncated item reads the same way
// in both views instead of picking a different abbreviation per screen.
const TYPE_MOBILE_LABEL: Record<AssignmentType, string> = {
  assignment: 'ASSIGN',
  exam: 'EXAM',
  quiz: 'QUIZ',
  project: 'PROJECT',
  reading: 'READING',
  other: 'OTHER',
};

// Full 24-hour day, like Google Calendar/Outlook - a hardcoded 7am-9pm window
// would silently hide any class or task that lands outside "typical" hours
// (an 11pm lab section, a midnight assignment reminder). The grid scrolls
// instead, auto-jumped to a sensible start time on mount.
const START_HOUR = 0;
const END_HOUR = 24;
const HOUR_HEIGHT = 48;
const GRID_HEIGHT = (END_HOUR - START_HOUR) * HOUR_HEIGHT;
const DEFAULT_SCROLL_HOUR = 7;
const VISIBLE_HOURS = 13;

const HOUR_LABELS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);

const dayHeaderFormatter = new Intl.DateTimeFormat('en-US', { weekday: 'short' });

const HEAT_TINT_CLASS: Record<WorkloadLevel, string> = {
  low: '',
  medium: 'bg-load-medium/5',
  high: 'bg-load-high/5',
  critical: 'bg-load-critical/10',
};

// #CA-1: mirrors MonthCalendar's due-here/prep-window split - a day column
// only gets the full background wash when something is literally due or in
// session that day. A day that only absorbed some of a *different* day's
// spread-out prep-time load gets a slim top border instead, so the two
// signals stay visually distinct here too.
const PREP_INDICATOR_CLASS: Record<WorkloadLevel, string> = {
  low: '',
  medium: 'border-t-2 border-load-medium/50',
  high: 'border-t-2 border-load-high/60',
  critical: 'border-t-2 border-load-critical/70',
};

export interface WeekViewProps {
  weekDays: Date[];
  today: Date;
  selectedDay: Date | null;
  onSelectDay: (day: Date) => void;
  itemsFor: (day: Date) => ScheduleItem[];
  meetingsFor: (day: Date) => MeetingOccurrence[];
  courseOf: (item: ScheduleItem) => Course | undefined;
  dailyLoad: Map<string, number>;
}

function hourLabel(hour: number): string {
  const period = hour >= 12 ? 'PM' : 'AM';
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display} ${period}`;
}

export function WeekView({
  weekDays,
  today,
  selectedDay,
  onSelectDay,
  itemsFor,
  meetingsFor,
  courseOf,
  dailyLoad,
}: WeekViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: DEFAULT_SCROLL_HOUR * HOUR_HEIGHT });
  }, []);

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[640px]">
        <div className="grid grid-cols-[3rem_repeat(7,1fr)]">
          <div />
          {weekDays.map((day) => {
            const isToday = isSameDay(day, today);
            const isSelected = selectedDay !== null && isSameDay(day, selectedDay);
            const dayItems = itemsFor(day);
            return (
              <button
                key={day.toISOString()}
                onClick={() => onSelectDay(day)}
                className={cn(
                  'flex flex-col items-center gap-1 rounded-t-lg py-2 text-center transition-colors',
                  isSelected ? 'bg-primary/10' : 'hover:bg-accent',
                )}
              >
                <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {dayHeaderFormatter.format(day)}
                </span>
                <span
                  className={cn(
                    'flex h-7 w-7 items-center justify-center rounded-full text-sm',
                    isToday
                      ? 'bg-gradient-brand font-bold text-white shadow-card'
                      : 'text-foreground',
                  )}
                >
                  {day.getDate()}
                </span>
                {dayItems.length > 0 && (
                  <span className="text-[9px] font-medium text-muted-foreground">
                    {dayItems.length} due
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div
          ref={scrollRef}
          style={{ maxHeight: VISIBLE_HOURS * HOUR_HEIGHT }}
          className="overflow-y-auto"
        >
          <div className="grid grid-cols-[3rem_repeat(7,1fr)]">
            <div style={{ height: GRID_HEIGHT }} className="relative">
              {HOUR_LABELS.map((hour) => (
                <div
                  key={hour}
                  className="absolute right-1 -translate-y-1/2 text-[10px] text-muted-foreground"
                  style={{ top: (hour - START_HOUR) * HOUR_HEIGHT }}
                >
                  {hourLabel(hour)}
                </div>
              ))}
            </div>

            {weekDays.map((day) => {
              const meetings = meetingsFor(day);
              const dueHere = meetings.length > 0 || itemsFor(day).length > 0;
              const hours = dailyLoad.get(toDayKey(day)) ?? 0;
              const heatLevel = getWorkloadLevel(hours);
              const isSelected = selectedDay !== null && isSameDay(day, selectedDay);

              return (
                <div
                  key={day.toISOString()}
                  style={{ height: GRID_HEIGHT }}
                  className={cn(
                    'relative border-l border-border',
                    isSelected
                      ? 'bg-primary/5'
                      : dueHere
                        ? HEAT_TINT_CLASS[heatLevel]
                        : PREP_INDICATOR_CLASS[heatLevel],
                  )}
                >
                  {HOUR_LABELS.map((hour) => (
                    <div
                      key={hour}
                      className="absolute left-0 right-0 border-t border-border/60"
                      style={{ top: (hour - START_HOUR) * HOUR_HEIGHT }}
                    />
                  ))}

                  {meetings.map((m, i) => {
                    const start = timeToFractionalHours(m.meeting.startTime);
                    const end = timeToFractionalHours(m.meeting.endTime);
                    if (end <= start) return null;
                    const top = (start - START_HOUR) * HOUR_HEIGHT;
                    const height = Math.max((end - start) * HOUR_HEIGHT, 20);
                    const swatch = courseSwatch(m.course.color);
                    return (
                      <div
                        key={`${m.course.id}-${i}`}
                        className={cn(
                          'absolute left-0.5 right-0.5 overflow-hidden rounded-md px-1 py-0.5 text-[10px] font-medium text-white shadow-sm',
                          swatch.className,
                        )}
                        style={{ top, height, ...swatch.style }}
                        title={`${m.course.code} · ${formatTimeLabel(m.meeting.startTime)}–${formatTimeLabel(m.meeting.endTime)}`}
                      >
                        <div className="flex items-center gap-0.5 truncate font-semibold">
                          <svg
                            className="h-2.5 w-2.5 shrink-0"
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
                          <span className="truncate">{m.course.code}</span>
                        </div>
                        {height > 32 && (
                          <div className="truncate opacity-90">
                            {formatTimeLabel(m.meeting.startTime)}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-2 grid grid-cols-[3rem_repeat(7,1fr)] gap-1 border-t border-border px-0.5 pt-2">
          <div />
          {weekDays.map((day) => {
            // #CA-5: same priority/urgency-first ordering as the month grid,
            // so this column's 3-chip preview surfaces the important items
            // rather than whichever were inserted first.
            const items = sortItemsByUrgency(itemsFor(day), today);
            return (
              <div key={day.toISOString()} className="space-y-0.5">
                {items.slice(0, 3).map((item) => (
                  <span
                    key={item.id}
                    title={item.title}
                    className={cn(
                      'flex items-center gap-0.5 truncate rounded px-1 py-0.5 text-[9px] font-medium text-white',
                      courseOf(item)?.color || 'bg-primary',
                      item.completed && 'opacity-40 line-through',
                    )}
                  >
                    <svg
                      className="hidden h-2 w-2 shrink-0 sm:block"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M4 3v18M4 4h11l-2 4 2 4H4" />
                    </svg>
                    {/* #CA-3: mobile leads with the short, uppercase type
                        instead of the title so similarly-named items stay
                        distinguishable once truncated. */}
                    <span className="min-w-0 truncate sm:hidden">
                      {TYPE_MOBILE_LABEL[item.type]}
                    </span>
                    <span className="hidden min-w-0 truncate sm:inline">{item.title}</span>
                  </span>
                ))}
                {items.length > 3 && (
                  <button
                    type="button"
                    onClick={() => onSelectDay(day)}
                    className="block w-full text-left text-[9px] font-semibold text-muted-foreground hover:text-primary hover:underline"
                  >
                    +{items.length - 3} more due
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
