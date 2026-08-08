import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Schedule | Syllabus Sense',
  description: 'Manage your class schedule and assignments.',
};

export default function SchedulePage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">Schedule</h1>
      <p className="text-muted-foreground text-sm">This page will be built out in a later issue.</p>
    </div>
  );
}
