import type { Metadata } from 'next';
import { PlannerView } from '@/components/schedule/PlannerView';

export const metadata: Metadata = {
  title: 'Schedule | Syllabus Sense',
  description: 'Manage your class schedule and assignments.',
};

export default function SchedulePage() {
  return <PlannerView />;
}
