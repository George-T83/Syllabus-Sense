'use client';

import { CardActionButton, SyllabusIcon } from '@/components/ui/CardAction';
import { RemoveSampleDataButton } from '@/components/sample/RemoveSampleDataButton';

export interface SampleDataBannerProps {
  onRemove: () => void | Promise<void>;
  onUploadSyllabus: () => void;
  removing?: boolean;
}

/**
 * A thin strip shown on the dashboard while any sample record exists. It is
 * deliberately not dismissible: it goes away when the sample does.
 */
export function SampleDataBanner({ onRemove, onUploadSyllabus, removing }: SampleDataBannerProps) {
  return (
    <div
      role="status"
      data-testid="sample-data-banner"
      className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-xl bg-primary/5 px-4 py-2"
    >
      <p className="text-sm text-foreground">
        You&apos;re looking at sample data. Add your own syllabus whenever you&apos;re ready.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <CardActionButton variant="primary" onClick={onUploadSyllabus}>
          <SyllabusIcon />
          Upload a syllabus
        </CardActionButton>
        <RemoveSampleDataButton onRemove={onRemove} removing={removing} />
      </div>
    </div>
  );
}
