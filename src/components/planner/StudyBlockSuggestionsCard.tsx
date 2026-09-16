'use client';

import { useMemo } from 'react';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { SectionIcon } from '@/components/ui/SectionIcon';
import { useAppState } from '@/context/AppStateContext';
import { suggestStudyBlocks, type StudyScheduleEntry } from '@/lib/planner/suggestStudyBlocks';
import { formatTimeLabel } from '@/lib/calendar/meetings';
import { parseDayKey } from '@/lib/calendar/dates';
import { WEEKDAY_SHORT_DATE_FORMATTER } from '@/lib/dateFormatters';
import { courseSwatch } from '@/lib/courseColors';
import { ICON_PATHS } from '@/lib/icons';

/**
 * Time-blocking auto-scheduler (Part B): turns the upcoming backlog into
 * concrete "when" suggestions, fit around each day's recurring class
 * meetings and work shifts (lib/planner/suggestStudyBlocks.ts). Read-only
 * and advisory - nothing here is persisted or editable; it's just a
 * smarter way to look at the same schedule already loaded everywhere else
 * on this page.
 */
export function StudyBlockSuggestionsCard() {
  const { state } = useAppState();

  const groupedByDay = useMemo(() => {
    const suggestions = suggestStudyBlocks(
      state.scheduleItems,
      state.courses,
      state.preferences.workShifts ?? [],
    );
    const groups = new Map<string, StudyScheduleEntry[]>();
    for (const entry of suggestions) {
      const existing = groups.get(entry.dateKey);
      if (existing) existing.push(entry);
      else groups.set(entry.dateKey, [entry]);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [state.scheduleItems, state.courses, state.preferences.workShifts]);

  const courseById = useMemo(() => new Map(state.courses.map((c) => [c.id, c])), [state.courses]);

  return (
    <Card className="rounded-2xl p-6">
      <div className="flex items-center gap-3">
        <SectionIcon icon="clock" />
        <div>
          <h2 className="text-base font-semibold text-foreground">Suggested Study Blocks</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Concrete times to work on what&rsquo;s due, fit around your class and work schedule.
          </p>
        </div>
      </div>

      {groupedByDay.length === 0 ? (
        <EmptyState
          icon={
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d={ICON_PATHS.clock} />
            </svg>
          }
          title="Nothing to schedule yet"
          description="Add an upcoming task with estimated hours to get study-time suggestions."
        />
      ) : (
        <div className="mt-5 space-y-4">
          {groupedByDay.map(([dateKey, dayEntries]) => (
            <div key={dateKey}>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {WEEKDAY_SHORT_DATE_FORMATTER.format(parseDayKey(dateKey))}
              </p>
              <ul className="mt-2 space-y-1.5">
                {dayEntries.map((entry, i) => {
                  if (entry.kind === 'break') {
                    return (
                      <li
                        key={`break-${i}`}
                        className="flex items-center justify-center gap-1.5 py-1 text-xs text-muted-foreground"
                      >
                        <span className="h-1 w-1 rounded-full bg-border" />
                        <span>Break until {formatTimeLabel(entry.endTime)}</span>
                        <span className="h-1 w-1 rounded-full bg-border" />
                      </li>
                    );
                  }
                  const course = courseById.get(entry.item.courseId);
                  const swatch = courseSwatch(course?.color);
                  return (
                    <li
                      key={`${entry.item.id}-${i}`}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span
                          className={`h-2 w-2 shrink-0 rounded-full ${swatch.className}`}
                          style={swatch.style}
                        />
                        <span className="truncate font-medium text-foreground">
                          {entry.item.title}
                        </span>
                      </span>
                      <span className="shrink-0 text-muted-foreground">
                        {formatTimeLabel(entry.startTime)} – {formatTimeLabel(entry.endTime)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
