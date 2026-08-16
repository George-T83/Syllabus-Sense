import type { Metadata } from 'next';
import { Card } from '@/components/ui/Card';
import { mockCourses, mockScheduleItems } from '@/lib/mock-data';

export const metadata: Metadata = {
  title: 'Dashboard | Syllabus Sense',
  description: 'View your AI-assisted syllabus and schedule tracker dashboard.',
};

const dueDateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });

export default function DashboardPage() {
  const pendingTasks = mockScheduleItems.filter((item) => !item.completed);
  const completedTasksCount = mockScheduleItems.length - pendingTasks.length;
  const termProgressPct = mockScheduleItems.length
    ? Math.round((completedTasksCount / mockScheduleItems.length) * 100)
    : 0;

  const courseLoad = mockCourses.map((course) => {
    const items = mockScheduleItems.filter((item) => item.courseId === course.id);
    const completed = items.filter((item) => item.completed).length;
    const pct = items.length ? Math.round((completed / items.length) * 100) : 0;
    return { course, pct };
  });

  const upcomingTasks = pendingTasks
    .slice()
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
    .slice(0, 3);

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Dashboard Overview</h1>
        <p className="text-sm text-muted-foreground mt-1">Fall 2026</p>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        {/* Stat rail */}
        <div className="flex flex-row md:flex-col gap-3 md:w-40 shrink-0">
          <Card className="rounded-xl bg-primary/10 border-0 shadow-none p-4 flex-1 flex flex-col justify-center">
            <div className="text-2xl font-bold text-primary">{termProgressPct}%</div>
            <div className="text-xs text-muted-foreground mt-0.5">Term Progress</div>
          </Card>
          <Card className="rounded-xl bg-muted/60 border-0 shadow-none p-4 flex-1 flex flex-col justify-center">
            <div className="text-2xl font-bold text-foreground">{mockCourses.length}</div>
            <div className="text-xs text-muted-foreground mt-0.5">Courses</div>
          </Card>
          <Card className="rounded-xl bg-load-medium/10 border-0 shadow-none p-4 flex-1 flex flex-col justify-center">
            <div className="text-2xl font-bold text-load-medium">{pendingTasks.length}</div>
            <div className="text-xs text-muted-foreground mt-0.5">Pending</div>
          </Card>
          <Card className="rounded-xl bg-load-low/10 border-0 shadow-none p-4 flex-1 flex flex-col justify-center">
            <div className="text-2xl font-bold text-load-low">{completedTasksCount}</div>
            <div className="text-xs text-muted-foreground mt-0.5">Completed</div>
          </Card>
        </div>

        {/* Main content column */}
        <div className="flex-1 flex flex-col gap-4">
          {/* Course Load panel */}
          <Card className="rounded-2xl p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-foreground">Course Load</h2>
              <span className="text-xs text-muted-foreground">Fall 2026</span>
            </div>
            <div className="space-y-5">
              {courseLoad.map(({ course, pct }) => (
                <div key={course.id}>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="font-medium text-foreground">
                      {course.code} · {course.title}
                    </span>
                    <span className="text-muted-foreground">{pct}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full ${course.color || 'bg-primary'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Upcoming Tasks panel */}
          <Card className="rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-foreground">Upcoming Tasks</h2>
              <span className="text-xs text-muted-foreground">Next {upcomingTasks.length}</span>
            </div>
            <div className="divide-y divide-border">
              {upcomingTasks.map((item) => {
                const course = mockCourses.find((c) => c.id === item.courseId);
                return (
                  <div key={item.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                    <span
                      className={`h-2 w-2 rounded-full shrink-0 ${course?.color || 'bg-primary'}`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-foreground truncate">
                        {item.title}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {course ? course.code : 'General'}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground shrink-0">
                      Due {dueDateFormatter.format(new Date(item.dueDate))}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
