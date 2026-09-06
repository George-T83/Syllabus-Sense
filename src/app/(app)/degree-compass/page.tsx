import type { Metadata } from 'next';
import { DegreeCompassView } from '@/components/degreeCompass/DegreeCompassView';

export const metadata: Metadata = {
  title: 'Degree Compass | Syllabus Sense',
  description: 'Track your progress toward graduation across every term.',
};

export default function DegreeCompassPage() {
  return (
    <div className="max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Degree Compass</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Your whole degree, one plan - past, current, and planned courses against what&rsquo;s
          still required.
        </p>
      </div>
      <DegreeCompassView />
    </div>
  );
}
