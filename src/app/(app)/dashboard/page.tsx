import type { Metadata } from 'next';
import { DashboardView } from '@/components/dashboard/DashboardView';

export const metadata: Metadata = {
  title: 'Dashboard | Syllabus Sense',
  description: 'View your AI-assisted syllabus and schedule tracker dashboard.',
};

export default function DashboardPage() {
  return <DashboardView />;
}
