import type { Metadata } from 'next';
import { MoodRecapView } from '@/components/mood/MoodRecapView';
import { PageHeader } from '@/components/ui/PageHeader';

export const metadata: Metadata = {
  title: 'Mood Recap | Syllabus Sense',
  description: 'Your daily check-ins, how they trend, and how they line up with your workload.',
};

export default function MoodPage() {
  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader
        eyebrow="You"
        title="Mood Recap"
        description={<>Every check-in, how it trends, and how it lines up with your workload.</>}
      />
      <MoodRecapView />
    </div>
  );
}
