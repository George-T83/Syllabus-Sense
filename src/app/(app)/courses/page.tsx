import type { Metadata } from 'next';
import { CoursesListView } from '@/components/courses/CoursesListView';

export const metadata: Metadata = {
  title: 'Courses | Syllabus Sense',
  description: 'Search, filter, and sort your courses.',
};

export default function CoursesPage() {
  return <CoursesListView />;
}
