import type { Metadata } from 'next';
import { DegreeCompassView } from '@/components/degreeCompass/DegreeCompassView';
import { PageHeader } from '@/components/ui/PageHeader';

export const metadata: Metadata = {
  title: 'Degree Compass | Syllabus Sense',
  description: 'Track your progress toward graduation across every term.',
};

export default function DegreeCompassPage() {
  return (
    <div className="max-w-6xl space-y-6">
      <PageHeader
        eyebrow="Planning"
        title="Degree Compass"
        description={
          <>
            Your whole degree, one plan - past, current, and planned courses against what&rsquo;s
            still required.
          </>
        }
      />
      <DegreeCompassView />
    </div>
  );
}
