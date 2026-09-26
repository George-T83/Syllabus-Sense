import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AdvisorView } from '@/components/advisor/AdvisorView';
import { PageHeader } from '@/components/ui/PageHeader';

export const metadata: Metadata = {
  title: 'Advisor | Syllabus Sense',
  description: 'A standing conversation about your whole degree.',
};

export default function AdvisorPage() {
  return (
    <div className="max-w-6xl space-y-6">
      <PageHeader
        eyebrow="Planning"
        title="Advisor"
        description={
          <>A standing conversation about your whole degree - not a per-syllabus drawer.</>
        }
      />
      <Suspense fallback={null}>
        <AdvisorView />
      </Suspense>
    </div>
  );
}
