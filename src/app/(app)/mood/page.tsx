import type { Metadata } from 'next';
import { MoodRecapView } from '@/components/mood/MoodRecapView';

export const metadata: Metadata = {
  title: 'Mood Recap | Syllabus Sense',
  description: 'Your daily check-ins, how they trend, and how they line up with your workload.',
};

export default function MoodPage() {
  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Mood Recap</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Every check-in, how it trends, and how it lines up with your workload.
        </p>
      </div>
      <MoodRecapView />
    </div>
  );
}
