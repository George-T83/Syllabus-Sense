import { redirect } from 'next/navigation';

// The standalone Planner page merged into /tasks (which now covers both
// browsing/filtering tasks and the workload-aware "what to start when"
// plan) - this route survives only so old links/bookmarks still land
// somewhere real.
export default function PlannerPage() {
  redirect('/tasks');
}
