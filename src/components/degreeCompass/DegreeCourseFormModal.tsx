'use client';

import { useState, useEffect, type FormEvent } from 'react';
import { useModalA11y } from '@/hooks/useModalA11y';
import type {
  DegreeCourse,
  DegreeCourseStatus,
  DegreeRequirementCategory,
} from '@/types/degreeCompass';

const inputClass =
  'w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary';

const STATUS_OPTIONS: { value: DegreeCourseStatus; label: string }[] = [
  { value: 'completed', label: 'Completed' },
  { value: 'in-progress', label: 'In progress' },
  { value: 'planned', label: 'Planned' },
];

export interface DegreeCourseFormValues {
  term: string;
  code: string;
  title: string;
  credits: number;
  categoryId: string;
  status: DegreeCourseStatus;
}

export interface DegreeCourseFormModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: DegreeCourseFormValues) => Promise<void>;
  categories: DegreeRequirementCategory[];
  initialCourse?: DegreeCourse;
}

function toFormValues(
  course: DegreeCourse | undefined,
  categories: DegreeRequirementCategory[],
): DegreeCourseFormValues {
  return {
    term: course?.term ?? '',
    code: course?.code ?? '',
    title: course?.title ?? '',
    credits: course?.credits ?? 3,
    categoryId: course?.categoryId ?? categories[0]?.id ?? '',
    status: course?.status ?? 'planned',
  };
}

export function DegreeCourseFormModal({
  open,
  onClose,
  onSubmit,
  categories,
  initialCourse,
}: DegreeCourseFormModalProps) {
  const containerRef = useModalA11y<HTMLDivElement>(open, onClose);
  const [values, setValues] = useState<DegreeCourseFormValues>(() =>
    toFormValues(initialCourse, categories),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setValues(toFormValues(initialCourse, categories));
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialCourse]);

  if (!open) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!values.term.trim() || !values.code.trim() || !values.categoryId) {
      setError('Term, course code, and category are required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSubmit(values);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save that course.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="degree-course-modal-title"
    >
      <div
        ref={containerRef}
        className="w-full max-w-md rounded-glass-lg border border-border bg-card p-5 shadow-card"
      >
        <h2 id="degree-course-modal-title" className="text-base font-bold text-foreground">
          {initialCourse ? 'Edit course' : 'Add course'}
        </h2>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="degree-course-term" className="text-xs font-medium text-foreground">
                Term
              </label>
              <input
                id="degree-course-term"
                value={values.term}
                onChange={(e) => setValues({ ...values, term: e.target.value })}
                className={inputClass}
                placeholder="Fall 2026"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="degree-course-code" className="text-xs font-medium text-foreground">
                Course code
              </label>
              <input
                id="degree-course-code"
                value={values.code}
                onChange={(e) => setValues({ ...values, code: e.target.value })}
                className={inputClass}
                placeholder="CS 301"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="degree-course-title" className="text-xs font-medium text-foreground">
              Title (optional)
            </label>
            <input
              id="degree-course-title"
              value={values.title}
              onChange={(e) => setValues({ ...values, title: e.target.value })}
              className={inputClass}
              placeholder="Algorithms"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label
                htmlFor="degree-course-credits"
                className="text-xs font-medium text-foreground"
              >
                Credits
              </label>
              <input
                id="degree-course-credits"
                type="number"
                min={0}
                step={0.5}
                value={values.credits}
                onChange={(e) => setValues({ ...values, credits: Number(e.target.value) })}
                className={inputClass}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="degree-course-status" className="text-xs font-medium text-foreground">
                Status
              </label>
              <select
                id="degree-course-status"
                value={values.status}
                onChange={(e) =>
                  setValues({ ...values, status: e.target.value as DegreeCourseStatus })
                }
                className={inputClass}
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="degree-course-category" className="text-xs font-medium text-foreground">
              Counts toward
            </label>
            <select
              id="degree-course-category"
              value={values.categoryId}
              onChange={(e) => setValues({ ...values, categoryId: e.target.value })}
              className={inputClass}
            >
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          {error && (
            <div className="rounded-lg border border-load-critical/30 bg-load-critical/10 px-3 py-2 text-sm text-load-critical">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-3.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {saving ? 'Saving…' : initialCourse ? 'Save changes' : 'Add course'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
