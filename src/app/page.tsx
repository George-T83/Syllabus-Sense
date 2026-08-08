export default function Home() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Welcome to Syllabus Sense</h1>
        <p className="text-muted-foreground text-lg">
          Your AI-assisted syllabus and schedule tracker.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass rounded-glass p-glass-padding space-y-3">
          <h2 className="text-xl font-semibold">Dashboard</h2>
          <p className="text-sm text-muted-foreground">
            Get an overview of your upcoming assignments, loaded workload, and course performance.
          </p>
        </div>

        <div className="glass rounded-glass p-glass-padding space-y-3">
          <h2 className="text-xl font-semibold">Schedule</h2>
          <p className="text-sm text-muted-foreground">
            View your weekly schedule, parsed directly from your syllabi.
          </p>
        </div>

        <div className="glass rounded-glass p-glass-padding space-y-3">
          <h2 className="text-xl font-semibold">Profile</h2>
          <p className="text-sm text-muted-foreground">
            Manage your account settings, class colors, and preference configurations.
          </p>
        </div>
      </div>
    </div>
  );
}
