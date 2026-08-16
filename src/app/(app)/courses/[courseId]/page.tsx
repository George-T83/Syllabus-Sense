import { CourseDetailView } from '@/components/courses/CourseDetailView';

export default function CourseDetailPage({ params }: { params: { courseId: string } }) {
  return <CourseDetailView courseId={params.courseId} />;
}
