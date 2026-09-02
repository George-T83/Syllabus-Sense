'use client';

import { useState } from 'react';
import { useSyllabi } from '@/lib/firestore/useSyllabi';
import { deleteSyllabusUpload } from '@/lib/firestore/syllabi';
import { DocumentViewerModal } from '@/components/syllabus/DocumentViewerModal';
import type { SyllabusUpload } from '@/types/syllabus';

export interface SyllabusListProps {
  userId: string | undefined;
  courseId: string;
}

function formatSize(bytes: number | undefined): string {
  // A legacy/partial-upload document can be missing sizeBytes entirely -
  // without this guard, `undefined / (1024*1024)` renders literally "NaN MB"
  // to the user instead of degrading gracefully.
  if (typeof bytes !== 'number' || Number.isNaN(bytes)) return 'Unknown size';
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileTypeIcon({ fileName }: { fileName: string }) {
  const isPdf = fileName.toLowerCase().endsWith('.pdf');
  return (
    <span
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold text-white ${isPdf ? 'bg-red-500' : 'bg-blue-500'}`}
    >
      {isPdf ? 'PDF' : 'DOC'}
    </span>
  );
}

export function SyllabusList({ userId, courseId }: SyllabusListProps) {
  const syllabi = useSyllabi(userId, courseId);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [viewingSyllabus, setViewingSyllabus] = useState<SyllabusUpload | null>(null);

  if (syllabi.length === 0) return null;

  return (
    <div className="space-y-2">
      {syllabi.map((syllabus) => (
        <div
          key={syllabus.id}
          className="flex items-center gap-3 rounded-lg border border-border px-3 py-2 text-sm"
        >
          <FileTypeIcon fileName={syllabus.fileName} />
          <div className="min-w-0 flex-1">
            <button
              onClick={() => setViewingSyllabus(syllabus)}
              className="block truncate text-left font-medium text-foreground hover:text-primary hover:underline"
            >
              {syllabus.fileName}
            </button>
            <span className="text-xs text-muted-foreground">{formatSize(syllabus.sizeBytes)}</span>
          </div>
          {confirmingDeleteId === syllabus.id ? (
            <div className="flex items-center gap-2 text-xs shrink-0">
              <button
                onClick={() => {
                  if (userId) deleteSyllabusUpload(userId, syllabus);
                  setConfirmingDeleteId(null);
                }}
                className="font-semibold text-destructive hover:underline"
              >
                Confirm
              </button>
              <button
                onClick={() => setConfirmingDeleteId(null)}
                className="text-muted-foreground hover:underline"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmingDeleteId(syllabus.id)}
              className="text-xs font-semibold text-destructive hover:underline shrink-0"
            >
              Delete
            </button>
          )}
        </div>
      ))}
      <DocumentViewerModal syllabus={viewingSyllabus} onClose={() => setViewingSyllabus(null)} />
    </div>
  );
}
