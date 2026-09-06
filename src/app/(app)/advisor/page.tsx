import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AdvisorView } from '@/components/advisor/AdvisorView';

export const metadata: Metadata = {
  title: 'Advisor | Syllabus Sense',
  description: 'A standing conversation about your whole degree.',
};

export default function AdvisorPage() {
  return (
    <div className="max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Advisor</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          A standing conversation about your whole degree - not a per-syllabus drawer.
        </p>
      </div>
      <Suspense fallback={null}>
        <AdvisorView />
      </Suspense>
    </div>
  );
}
