'use client';

import { useState } from 'react';
import { useSyllabi } from '@/lib/firestore/useSyllabi';
import { deleteSyllabusUpload } from '@/lib/firestore/syllabi';

export interface SyllabusListProps {
  userId: string | undefined;
  courseId: string;
}

function formatSize(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function SyllabusList({ userId, courseId }: SyllabusListProps) {
  const syllabi = useSyllabi(userId, courseId);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);

  if (syllabi.length === 0) return null;

  return (
    <div className="space-y-2">
      {syllabi.map((syllabus) => (
        <div
          key={syllabus.id}
          className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm"
        >
          <div className="min-w-0 flex-1">
            <a
              href={syllabus.downloadURL}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-foreground hover:text-primary hover:underline truncate block"
            >
              {syllabus.fileName}
            </a>
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
    </div>
  );
}
