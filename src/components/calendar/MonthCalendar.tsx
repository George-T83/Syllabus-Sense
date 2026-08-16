'use client';

import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { useAppState } from '@/context/AppStateContext';
import {
  addMonths,
  getMonthGrid,
  groupItemsByDay,
  isSameDay,
  toDayKey,
  startOfDay,
} from '@/lib/calendar/dates';
import { cn } from '@/lib/utils';
import type { ScheduleItem } from '@/types/schedule';

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const monthLabelFormatter = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' });
const dayLabelFormatter = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
});

export function MonthCalendar() {
  const { state } = useAppState();
  const [viewMonth, setViewMonth] = useState(() => startOfDay(new Date()));
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  const today = useMemo(() => startOfDay(new Date()), []);
  const itemsByDay = useMemo(() => groupItemsByDay(state.scheduleItems), [state.scheduleItems]);
  const grid = useMemo(() => getMonthGrid(viewMonth), [viewMonth]);

  const courseColor = (item: ScheduleItem) =>
    state.courses.find((c) => c.id === item.courseId)?.color || 'bg-primary';

  const selectedItems = selectedDay ? (itemsByDay.get(toDayKey(selectedDay)) ?? []) : [];

  return (
    <div className="space-y-4">
      <Card className="rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-foreground">
            {monthLabelFormatter.format(viewMonth)}
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMonth((m) => addMonths(m, -1))}
              aria-label="Previous month"
              className="rounded-lg px-2 py-1 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              ←
            </button>
            <button
              onClick={() => setViewMonth(startOfDay(new Date()))}
              className="rounded-lg px-2 py-1 text-xs font-semibold text-primary hover:underline"
            >
              Today
            </button>
            <button
              onClick={() => setViewMonth((m) => addMonths(m, 1))}
              aria-label="Next month"
              className="rounded-lg px-2 py-1 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              →
            </button>
          </div>
        </div>

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

        <div className="grid grid-cols-7 gap-1">
          {grid.map((day) => {
            const dayItems = itemsByDay.get(toDayKey(day)) ?? [];
            const inCurrentMonth = day.getMonth() === viewMonth.getMonth();
            const isToday = isSameDay(day, today);
            const isSelected = selectedDay !== null && isSameDay(day, selectedDay);

            return (
              <button
                key={day.toISOString()}
                onClick={() => setSelectedDay(day)}
                className={cn(
                  'aspect-square rounded-lg p-1.5 flex flex-col items-start gap-1 text-left transition-colors',
                  inCurrentMonth ? 'hover:bg-accent' : 'opacity-40 hover:bg-accent/50',
                  isSelected && 'ring-2 ring-primary',
                  isToday && !isSelected && 'bg-primary/10',
                )}
              >
                <span
                  className={cn('text-xs', isToday ? 'font-bold text-primary' : 'text-foreground')}
                >
                  {day.getDate()}
                </span>
                <div className="flex flex-wrap gap-0.5">
                  {dayItems.slice(0, 4).map((item) => (
                    <span
                      key={item.id}
                      className={cn(
                        'h-1.5 w-1.5 rounded-full',
                        courseColor(item),
                        item.completed && 'opacity-40',
                      )}
                    />
                  ))}
                  {dayItems.length > 4 && (
                    <span className="text-[9px] leading-none text-muted-foreground">
                      +{dayItems.length - 4}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </Card>

      {selectedDay && (
        <Card className="rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-foreground mb-3">
            {dayLabelFormatter.format(selectedDay)}
          </h3>
          {selectedItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing due this day.</p>
          ) : (
            <div className="divide-y divide-border">
              {selectedItems.map((item) => {
                const course = state.courses.find((c) => c.id === item.courseId);
                return (
                  <div key={item.id} className="flex items-center gap-3 py-2 first:pt-0 last:pb-0">
                    <span className={cn('h-2 w-2 rounded-full shrink-0', courseColor(item))} />
                    <div className="min-w-0 flex-1">
                      <div
                        className={cn(
                          'text-sm font-medium truncate',
                          item.completed ? 'text-muted-foreground line-through' : 'text-foreground',
                        )}
                      >
                        {item.title}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {course ? course.code : 'General'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
