'use client';

import { useState } from 'react';
import { useSyllabi } from '@/lib/firestore/useSyllabi';
import {
  deleteSyllabusUpload,
  setPrimarySyllabus,
  getPrimarySyllabus,
} from '@/lib/firestore/syllabi';
import { DocumentViewerModal } from '@/components/syllabus/DocumentViewerModal';
import { useToast } from '@/components/ui/Toast';
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
  const syllabiUnsorted = useSyllabi(userId, courseId);
  const { showSuccess, showError } = useToast();
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [settingPrimaryId, setSettingPrimaryId] = useState<string | null>(null);
  const [viewingSyllabus, setViewingSyllabus] = useState<SyllabusUpload | null>(null);

  const syllabi = [...syllabiUnsorted].sort(
    (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime(),
  );
  const primaryId = getPrimarySyllabus(syllabi)?.id;

  const handleDelete = async (syllabus: SyllabusUpload) => {
    if (!userId) return;
    setDeletingId(syllabus.id);
    try {
      await deleteSyllabusUpload(userId, syllabus);
      setConfirmingDeleteId(null);
      showSuccess('Syllabus deleted', `${syllabus.fileName} was removed.`);
    } catch (err) {
      showError('Could not delete this syllabus', err instanceof Error ? err.message : undefined);
    } finally {
      setDeletingId(null);
    }
  };

  const handleSetPrimary = async (syllabus: SyllabusUpload) => {
    if (!userId) return;
    setSettingPrimaryId(syllabus.id);
    try {
      await setPrimarySyllabus(userId, courseId, syllabus.id);
      showSuccess('Primary syllabus updated', `${syllabus.fileName} is now the current version.`);
    } catch (err) {
      showError('Could not set primary syllabus', err instanceof Error ? err.message : undefined);
    } finally {
      setSettingPrimaryId(null);
    }
  };

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
            <div className="flex items-center gap-2">
              <button
                onClick={() => setViewingSyllabus(syllabus)}
                className="truncate text-left font-medium text-foreground hover:text-primary hover:underline"
              >
                {syllabus.fileName}
              </button>
              {syllabus.id === primaryId && (
                <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                  Primary
                </span>
              )}
            </div>
            <span className="text-xs text-muted-foreground">{formatSize(syllabus.sizeBytes)}</span>
          </div>
          {confirmingDeleteId === syllabus.id ? (
            <div className="flex items-center gap-1.5 text-xs shrink-0">
              <button
                onClick={() => handleDelete(syllabus)}
                disabled={deletingId === syllabus.id}
                className="rounded-full bg-destructive/10 px-2.5 py-1 font-semibold text-destructive transition-colors hover:bg-destructive/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {deletingId === syllabus.id ? 'Deleting…' : 'Confirm'}
              </button>
              <button
                onClick={() => setConfirmingDeleteId(null)}
                disabled={deletingId === syllabus.id}
                className="rounded-full px-2.5 py-1 text-muted-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 shrink-0">
              {syllabus.id !== primaryId && (
                <button
                  onClick={() => handleSetPrimary(syllabus)}
                  disabled={settingPrimaryId === syllabus.id}
                  className="rounded-full px-2.5 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {settingPrimaryId === syllabus.id ? 'Setting…' : 'Set as primary'}
                </button>
              )}
              <button
                onClick={() => setConfirmingDeleteId(syllabus.id)}
                className="rounded-full px-2.5 py-1 text-xs font-semibold text-destructive transition-colors hover:bg-destructive/10"
              >
                Delete
              </button>
            </div>
          )}
        </div>
      ))}
      <DocumentViewerModal syllabus={viewingSyllabus} onClose={() => setViewingSyllabus(null)} />
    </div>
  );
}
