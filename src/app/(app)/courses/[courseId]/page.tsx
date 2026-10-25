import type { Metadata } from 'next';
import { CourseDetailView } from '@/components/courses/CourseDetailView';

export const metadata: Metadata = { title: 'Course' };

// Next 15 passes route params as a Promise.
export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  return <CourseDetailView courseId={courseId} />;
}
