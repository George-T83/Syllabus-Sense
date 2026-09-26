import type { Metadata } from 'next';
import { Suspense } from 'react';
import { MonthCalendar } from '@/components/calendar/MonthCalendar';
import { PageHeader } from '@/components/ui/PageHeader';

export const metadata: Metadata = {
  title: 'Calendar | Syllabus Sense',
  description: 'A monthly calendar of everything due.',
};

export default function CalendarPage() {
  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader
        eyebrow="Planning"
        title="Calendar"
        description={<>See your workload build before it hits — not just what&apos;s due.</>}
      />
      <Suspense fallback={null}>
        <MonthCalendar />
      </Suspense>
    </div>
  );
}
