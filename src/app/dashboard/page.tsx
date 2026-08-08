import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Dashboard | Syllabus Sense',
  description: 'View your AI-assisted syllabus and schedule tracker dashboard.',
};

export default function DashboardPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
      <p className="text-muted-foreground text-sm">This page will be built out in a later issue.</p>
    </div>
  );
}
