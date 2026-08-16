import type { Metadata } from 'next';
import { SmartPlanner } from '@/components/planner/SmartPlanner';

export const metadata: Metadata = {
  title: 'Planner | Syllabus Sense',
  description: 'A workload-aware plan of what to start when.',
};

export default function PlannerPage() {
  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Planner</h1>
        <p className="text-sm text-muted-foreground mt-1">
          What to start today, this week, and later - based on your actual workload.
        </p>
      </div>
      <SmartPlanner />
    </div>
  );
}
