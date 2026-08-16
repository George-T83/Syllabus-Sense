import type { Metadata } from 'next';
import { PlannerView } from '@/components/schedule/PlannerView';

export const metadata: Metadata = {
  title: 'Tasks | Syllabus Sense',
  description: 'Filter and sort every task across your courses.',
};

export default function TasksPage() {
  return <PlannerView />;
}
