'use client';

import { useState } from 'react';
import { DocumentViewerModal } from '@/components/syllabus/DocumentViewerModal';
import { cn } from '@/lib/utils';
import type { SyllabusUpload } from '@/types/syllabus';

/**
 * "Check the syllabus": opens the course's own syllabus in the in-app viewer
 * so the student can compare a date, a weight or a summary with the source.
 * Renders nothing when the course has no syllabus on file. The viewer is only
 * mounted once the link is used.
 */
export function CheckSyllabusButton({
  syllabus,
  className,
}: {
  syllabus: SyllabusUpload | null | undefined;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  if (!syllabus) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn('font-semibold text-primary hover:underline', className)}
      >
        Check the syllabus
      </button>
      {open && <DocumentViewerModal syllabus={syllabus} onClose={() => setOpen(false)} />}
    </>
  );
}
