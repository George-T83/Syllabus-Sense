'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { useModalA11y } from '@/hooks/useModalA11y';
import type { Source, SourceAuthor, SourceType } from '@/types/source';

export interface SourceFormValues {
  type: SourceType;
  title: string;
  authors: SourceAuthor[];
  year: string;
  publisher: string;
  journalName: string;
  volume: string;
  issue: string;
  pages: string;
  siteName: string;
  url: string;
  accessedDate: string;
  notes: string;
}

const SOURCE_TYPE_OPTIONS: { value: SourceType; label: string }[] = [
  { value: 'book', label: 'Book' },
  { value: 'website', label: 'Website' },
  { value: 'journal', label: 'Journal Article' },
  { value: 'other', label: 'Other' },
];

function emptyValues(): SourceFormValues {
  return {
    type: 'book',
    title: '',
    authors: [{ firstName: '', lastName: '' }],
    year: '',
    publisher: '',
    journalName: '',
    volume: '',
    issue: '',
    pages: '',
    siteName: '',
    url: '',
    accessedDate: '',
    notes: '',
  };
}

function valuesFromSource(source: Source): SourceFormValues {
  return {
    type: source.type,
    title: source.title,
    authors: source.authors.length > 0 ? source.authors : [{ firstName: '', lastName: '' }],
    year: source.year ?? '',
    publisher: source.publisher ?? '',
    journalName: source.journalName ?? '',
    volume: source.volume ?? '',
    issue: source.issue ?? '',
    pages: source.pages ?? '',
    siteName: source.siteName ?? '',
    url: source.url ?? '',
    accessedDate: source.accessedDate ?? '',
    notes: source.notes ?? '',
  };
}

export interface SourceFormModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: SourceFormValues) => Promise<void>;
  initialSource?: Source | null;
}

const fieldClass =
  'w-full min-h-[44px] rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary';
const labelClass = 'block text-xs font-semibold text-muted-foreground mb-1';

export function SourceFormModal({ open, onClose, onSubmit, initialSource }: SourceFormModalProps) {
  const [values, setValues] = useState<SourceFormValues>(emptyValues());
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setValues(initialSource ? valuesFromSource(initialSource) : emptyValues());
    setError(null);
  }, [open, initialSource]);

  const dialogRef = useModalA11y<HTMLDivElement>(open, onClose);

  if (!open) return null;

  const update = <K extends keyof SourceFormValues>(key: K, value: SourceFormValues[K]) =>
    setValues((v) => ({ ...v, [key]: value }));

  const updateAuthor = (index: number, field: keyof SourceAuthor, value: string) => {
    setValues((v) => ({
      ...v,
      authors: v.authors.map((a, i) => (i === index ? { ...a, [field]: value } : a)),
    }));
  };

  const addAuthor = () =>
    setValues((v) => ({ ...v, authors: [...v.authors, { firstName: '', lastName: '' }] }));

  const removeAuthor = (index: number) =>
    setValues((v) => ({ ...v, authors: v.authors.filter((_, i) => i !== index) }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!values.title.trim()) {
      setError('Title is required.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit({
        ...values,
        authors: values.authors.filter((a) => a.firstName.trim() || a.lastName.trim()),
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save this source. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4 py-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="source-form-title"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="w-full max-w-lg outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <Card accent="none">
          <CardHeader>
            <CardTitle id="source-form-title">
              {initialSource ? 'Edit Source' : 'Add Source'}
            </CardTitle>
            <CardDescription>Formatted into APA, MLA, or Chicago automatically.</CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="max-h-[65vh] space-y-4 overflow-y-auto">
              {error && (
                <div className="rounded-lg border border-load-critical/30 bg-load-critical/10 px-3 py-2 text-sm text-load-critical">
                  {error}
                </div>
              )}

              <div>
                <label className={labelClass}>Source type</label>
                <div className="flex flex-wrap gap-1.5">
                  {SOURCE_TYPE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => update('type', opt.value)}
                      className={`min-h-[36px] rounded-full px-3 text-xs font-semibold transition-colors ${
                        values.type === opt.value
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted/50 text-muted-foreground hover:bg-accent'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label htmlFor="source-title" className={labelClass}>
                  Title
                </label>
                <input
                  id="source-title"
                  value={values.title}
                  onChange={(e) => update('title', e.target.value)}
                  className={fieldClass}
                  required
                />
              </div>

              <div>
                <label className={labelClass}>Authors</label>
                <div className="space-y-2">
                  {values.authors.map((author, i) => (
                    <div key={i} className="flex gap-2">
                      <input
                        aria-label={`Author ${i + 1} first name`}
                        placeholder="First name"
                        value={author.firstName}
                        onChange={(e) => updateAuthor(i, 'firstName', e.target.value)}
                        className={fieldClass}
                      />
                      <input
                        aria-label={`Author ${i + 1} last name`}
                        placeholder="Last name"
                        value={author.lastName}
                        onChange={(e) => updateAuthor(i, 'lastName', e.target.value)}
                        className={fieldClass}
                      />
                      {values.authors.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeAuthor(i)}
                          aria-label={`Remove author ${i + 1}`}
                          className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-destructive"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={addAuthor}
                  className="mt-2 text-xs font-semibold text-primary hover:underline"
                >
                  + Add another author
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="source-year" className={labelClass}>
                    Year
                  </label>
                  <input
                    id="source-year"
                    value={values.year}
                    onChange={(e) => update('year', e.target.value)}
                    placeholder="2024"
                    className={fieldClass}
                  />
                </div>

                {values.type === 'book' && (
                  <div>
                    <label htmlFor="source-publisher" className={labelClass}>
                      Publisher
                    </label>
                    <input
                      id="source-publisher"
                      value={values.publisher}
                      onChange={(e) => update('publisher', e.target.value)}
                      className={fieldClass}
                    />
                  </div>
                )}
              </div>

              {values.type === 'website' && (
                <>
                  <div>
                    <label htmlFor="source-site-name" className={labelClass}>
                      Site name
                    </label>
                    <input
                      id="source-site-name"
                      value={values.siteName}
                      onChange={(e) => update('siteName', e.target.value)}
                      className={fieldClass}
                    />
                  </div>
                  <div>
                    <label htmlFor="source-url" className={labelClass}>
                      URL
                    </label>
                    <input
                      id="source-url"
                      type="url"
                      value={values.url}
                      onChange={(e) => update('url', e.target.value)}
                      className={fieldClass}
                    />
                  </div>
                  <div>
                    <label htmlFor="source-accessed" className={labelClass}>
                      Accessed on
                    </label>
                    <input
                      id="source-accessed"
                      type="date"
                      value={values.accessedDate}
                      onChange={(e) => update('accessedDate', e.target.value)}
                      className={fieldClass}
                    />
                  </div>
                </>
              )}

              {values.type === 'journal' && (
                <>
                  <div>
                    <label htmlFor="source-journal-name" className={labelClass}>
                      Journal name
                    </label>
                    <input
                      id="source-journal-name"
                      value={values.journalName}
                      onChange={(e) => update('journalName', e.target.value)}
                      className={fieldClass}
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label htmlFor="source-volume" className={labelClass}>
                        Volume
                      </label>
                      <input
                        id="source-volume"
                        value={values.volume}
                        onChange={(e) => update('volume', e.target.value)}
                        className={fieldClass}
                      />
                    </div>
                    <div>
                      <label htmlFor="source-issue" className={labelClass}>
                        Issue
                      </label>
                      <input
                        id="source-issue"
                        value={values.issue}
                        onChange={(e) => update('issue', e.target.value)}
                        className={fieldClass}
                      />
                    </div>
                    <div>
                      <label htmlFor="source-pages" className={labelClass}>
                        Pages
                      </label>
                      <input
                        id="source-pages"
                        value={values.pages}
                        onChange={(e) => update('pages', e.target.value)}
                        placeholder="210-234"
                        className={fieldClass}
                      />
                    </div>
                  </div>
                </>
              )}

              {values.type === 'other' && (
                <div>
                  <label htmlFor="source-notes" className={labelClass}>
                    Notes
                  </label>
                  <textarea
                    id="source-notes"
                    value={values.notes}
                    onChange={(e) => update('notes', e.target.value)}
                    rows={2}
                    className={fieldClass}
                  />
                </div>
              )}
            </CardContent>

            <div className="flex items-center justify-end gap-2 border-t border-border p-4">
              <button
                type="button"
                onClick={onClose}
                className="inline-flex min-h-[44px] items-center justify-center rounded-lg px-4 text-sm font-semibold text-muted-foreground transition-colors hover:bg-accent"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? 'Saving...' : initialSource ? 'Save Changes' : 'Add Source'}
              </button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
