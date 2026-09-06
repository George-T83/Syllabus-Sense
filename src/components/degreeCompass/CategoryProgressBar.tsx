import type { CategoryProgress } from '@/lib/degreeCompass/progress';

export function CategoryProgressBar({ progress }: { progress: CategoryProgress }) {
  const { category, creditsCompleted, creditsInProgress } = progress;
  const total = category.creditsRequired || 1;
  const completedPct = Math.min(100, (creditsCompleted / total) * 100);
  const inProgressPct = Math.min(100 - completedPct, (creditsInProgress / total) * 100);
  const earned = creditsCompleted + creditsInProgress;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="font-medium text-foreground">{category.name}</span>
        <span className="text-muted-foreground shrink-0">
          {earned} / {category.creditsRequired} cr
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-accent">
        <div className="flex h-full">
          <div className="h-full bg-primary" style={{ width: `${completedPct}%` }} />
          <div className="h-full bg-primary/40" style={{ width: `${inProgressPct}%` }} />
        </div>
      </div>
    </div>
  );
}
