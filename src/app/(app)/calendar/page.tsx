import type { Metadata } from 'next';
import { Suspense } from 'react';
import { MonthCalendar } from '@/components/calendar/MonthCalendar';

export const metadata: Metadata = {
  title: 'Calendar | Syllabus Sense',
  description: 'A monthly calendar of everything due.',
};

export default function CalendarPage() {
  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Calendar</h1>
        <p className="text-sm text-muted-foreground mt-1">
          See your workload build before it hits — not just what&apos;s due.
        </p>
      </div>
      <Suspense fallback={null}>
        <MonthCalendar />
      </Suspense>
    </div>
  );
}
