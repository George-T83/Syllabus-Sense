import { CourseDetailView } from '@/components/courses/CourseDetailView';

// Next 15 passes route params as a Promise.
export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  return <CourseDetailView courseId={courseId} />;
}
