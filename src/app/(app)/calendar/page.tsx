import type { Metadata } from 'next';
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
        <p className="text-sm text-muted-foreground mt-1">Click a day to see what&apos;s due.</p>
      </div>
      <MonthCalendar />
    </div>
  );
}
