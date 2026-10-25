import type { Metadata } from 'next';
import { TaskDetailView } from '@/components/tasks/TaskDetailView';

export const metadata: Metadata = { title: 'Task' };

// Next 15 passes route params as a Promise.
export default async function TaskDetailPage({ params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await params;
  return <TaskDetailView taskId={taskId} />;
}
