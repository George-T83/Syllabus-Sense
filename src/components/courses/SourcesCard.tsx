'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { CardActionButton } from '@/components/ui/CardAction';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import { useAppState } from '@/context/AppStateContext';
import { useAuth } from '@/context/AuthContext';
import { createSource, updateSource, deleteSource } from '@/lib/firestore/sources';
import { formatCitation, formatBibliography, sortSources } from '@/lib/citations/formatCitation';
import { SourceFormModal, type SourceFormValues } from '@/components/courses/SourceFormModal';
import { CITATION_STYLE_LABEL, type CitationStyle, type Source } from '@/types/source';
import type { Course } from '@/types/schedule';

const STYLES: CitationStyle[] = ['apa', 'mla', 'chicago'];

export function SourcesCard({ course }: { course: Course }) {
  const { state, dispatch } = useAppState();
  const { user } = useAuth();
  const { showError } = useToast();

  const [style, setStyle] = useState<CitationStyle>('apa');
  const [formOpen, setFormOpen] = useState(false);
  const [editingSource, setEditingSource] = useState<Source | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const sources = state.sources.filter((s) => s.courseId === course.id);

  const openCreate = () => {
    setEditingSource(null);
    setFormOpen(true);
  };

  const openEdit = (source: Source) => {
    setEditingSource(source);
    setFormOpen(true);
  };

  const handleSubmit = async (values: SourceFormValues) => {
    if (!user) throw new Error('You must be signed in to save a source.');

    const base = {
      courseId: course.id,
      type: values.type,
      title: values.title.trim(),
      authors: values.authors,
      ...(values.year.trim() ? { year: values.year.trim() } : {}),
      ...(values.publisher.trim() ? { publisher: values.publisher.trim() } : {}),
      ...(values.journalName.trim() ? { journalName: values.journalName.trim() } : {}),
      ...(values.volume.trim() ? { volume: values.volume.trim() } : {}),
      ...(values.issue.trim() ? { issue: values.issue.trim() } : {}),
      ...(values.pages.trim() ? { pages: values.pages.trim() } : {}),
      ...(values.siteName.trim() ? { siteName: values.siteName.trim() } : {}),
      ...(values.url.trim() ? { url: values.url.trim() } : {}),
      ...(values.accessedDate.trim() ? { accessedDate: values.accessedDate.trim() } : {}),
      ...(values.notes.trim() ? { notes: values.notes.trim() } : {}),
    };

    if (editingSource) {
      await updateSource(user.uid, editingSource, { id: editingSource.id, ...base }, dispatch);
    } else {
      await createSource(user.uid, { id: crypto.randomUUID(), ...base }, dispatch);
    }
  };

  const handleDelete = async (source: Source) => {
    if (!user) return;
    try {
      await deleteSource(user.uid, source, dispatch);
    } catch (err) {
      showError('Could not delete this source', err instanceof Error ? err.message : undefined);
    } finally {
      setConfirmingDeleteId(null);
    }
  };

  const handleCopyBibliography = async () => {
    const text = formatBibliography(sources, style);
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        showError('Could not copy the bibliography', 'Try selecting and copying the text below.');
      }
    }
  };

  return (
    <>
      <Card className="rounded-2xl p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-foreground">Sources</h2>
          <CardActionButton variant="solid" withPlus onClick={openCreate}>
            Add Source
          </CardActionButton>
        </div>

        {sources.length === 0 ? (
          <EmptyState
            icon={
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                />
              </svg>
            }
            title="No sources yet"
            description="Save sources as you research this course's papers, and copy a finished bibliography when you're done."
            action={{ label: '+ Add Source', onClick: openCreate }}
          />
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
              <div className="flex items-center rounded-xl bg-muted/50 p-1 border border-border">
                {STYLES.map((s) => (
                  <button
                    key={s}
                    onClick={() => setStyle(s)}
                    className={`min-h-[36px] rounded-lg px-3 text-xs font-semibold transition-all ${
                      style === s
                        ? 'bg-primary text-primary-foreground shadow-md'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {CITATION_STYLE_LABEL[s]}
                  </button>
                ))}
              </div>
              <button
                onClick={handleCopyBibliography}
                className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-primary/10 px-3 text-xs font-semibold text-primary transition-colors hover:bg-primary/20"
              >
                {copied ? 'Copied!' : 'Copy Full Bibliography'}
              </button>
            </div>

            <ul className="space-y-3">
              {sortSources(sources).map((source) => (
                <li key={source.id} className="flex items-start justify-between gap-3 text-sm">
                  <p className="text-foreground">{formatCitation(source, style)}</p>
                  <div className="flex shrink-0 items-center gap-1">
                    {confirmingDeleteId === source.id ? (
                      <>
                        <button
                          onClick={() => handleDelete(source)}
                          className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-destructive/10 px-3 text-xs font-semibold text-destructive transition-colors hover:bg-destructive/20"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => setConfirmingDeleteId(null)}
                          className="inline-flex min-h-[44px] items-center justify-center rounded-full px-3 text-xs text-muted-foreground transition-colors hover:bg-accent"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => openEdit(source)}
                          className="inline-flex min-h-[44px] items-center justify-center rounded-full px-3 text-xs font-semibold text-primary transition-colors hover:bg-primary/10"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setConfirmingDeleteId(source.id)}
                          className="inline-flex min-h-[44px] items-center justify-center rounded-full px-3 text-xs font-semibold text-destructive transition-colors hover:bg-destructive/10"
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>

      <SourceFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={handleSubmit}
        initialSource={editingSource}
      />
    </>
  );
}
