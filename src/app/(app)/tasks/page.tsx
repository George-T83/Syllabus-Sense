import type { Metadata } from 'next';
import { PlannerView } from '@/components/schedule/PlannerView';

export const metadata: Metadata = {
  title: 'Tasks | Syllabus Sense',
  description: 'Every task across your courses, plus a workload-aware plan of what to start when.',
};

export default function TasksPage() {
  return <PlannerView />;
}
