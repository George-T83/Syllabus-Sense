import { TaskDetailView } from '@/components/tasks/TaskDetailView';

export default function TaskDetailPage({ params }: { params: { taskId: string } }) {
  return <TaskDetailView taskId={params.taskId} />;
}
