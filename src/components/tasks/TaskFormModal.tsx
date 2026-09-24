'use client';

import { useEffect, useState, FormEvent } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/Card';
import { scheduleItemFormSchema, type ScheduleItemFormValues } from '@/lib/validation/scheduleItem';
import type { Course, ScheduleItem, AssignmentType, Priority } from '@/types/schedule';
import { cn } from '@/lib/utils';
import { useModalA11y } from '@/hooks/useModalA11y';
import { useDirtyClose } from '@/hooks/useDirtyClose';
import { DiscardConfirmCard } from '@/components/ui/DiscardConfirmCard';
import {
  estimateReadingHours,
  READING_DENSITY_OPTIONS,
  type ReadingDensity,
} from '@/lib/reading/estimateReadingHours';
import {
  generateRecurringInstances,
  type RecurrenceFrequency,
} from '@/lib/planner/recurringTaskTemplate';

const REPEAT_FREQUENCY_OPTIONS: { value: RecurrenceFrequency; label: string }[] = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Biweekly' },
];

const TYPE_OPTIONS: { value: AssignmentType; label: string }[] = [
  { value: 'assignment', label: 'Assignment' },
  { value: 'exam', label: 'Exam' },
  { value: 'quiz', label: 'Quiz' },
  { value: 'project', label: 'Project' },
  { value: 'reading', label: 'Reading' },
  { value: 'other', label: 'Other' },
];

const PRIORITY_OPTIONS: { value: Priority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];

export interface TaskFormModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: ScheduleItemFormValues) => Promise<void>;
  courses: Course[];
  initialItem?: ScheduleItem;
}

function emptyValues(defaultCourseId: string): ScheduleItemFormValues {
  return {
    title: '',
    type: 'assignment',
    courseId: defaultCourseId,
    dueDate: '',
    estimatedHours: '',
    priority: 'medium',
    notes: '',
    progress: '',
    gradeWeight: '',
    gradeCategory: '',
    assignedTo: '',
  };
}

export function TaskFormModal({
  open,
  onClose,
  onSubmit,
  courses,
  initialItem,
}: TaskFormModalProps) {
  const [values, setValues] = useState<ScheduleItemFormValues>(emptyValues(courses[0]?.id ?? ''));
  const [baseline, setBaseline] = useState<ScheduleItemFormValues>(
    emptyValues(courses[0]?.id ?? ''),
  );
  const [errors, setErrors] = useState<Partial<Record<keyof ScheduleItemFormValues, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [readingPages, setReadingPages] = useState('');
  const [readingDensity, setReadingDensity] = useState<ReadingDensity>('standard');
  /** Conflict-Aware Recurring Task Templates - only offered when creating a
   * new task (`!initialItem`); repeating an existing single task by editing
   * it doesn't make sense the way repeating at creation time does. */
  const [repeatEnabled, setRepeatEnabled] = useState(false);
  const [repeatFrequency, setRepeatFrequency] = useState<RecurrenceFrequency>('weekly');
  const [repeatOccurrences, setRepeatOccurrences] = useState(10);

  useEffect(() => {
    if (!open) return;
    setReadingPages('');
    setReadingDensity('standard');
    setRepeatEnabled(false);
    setRepeatFrequency('weekly');
    setRepeatOccurrences(10);
    const initial: ScheduleItemFormValues = initialItem
      ? {
          title: initialItem.title,
          type: initialItem.type,
          courseId: initialItem.courseId,
          dueDate: initialItem.dueDate.slice(0, 10),
          estimatedHours: initialItem.estimatedHours?.toString() ?? '',
          priority: initialItem.priority ?? 'medium',
          notes: initialItem.notes ?? '',
          progress: initialItem.progress?.toString() ?? '',
          gradeWeight: initialItem.gradeWeight?.toString() ?? '',
          gradeCategory: initialItem.gradeCategory ?? '',
          assignedTo: initialItem.assignedTo ?? '',
        }
      : emptyValues(courses[0]?.id ?? '');
    setValues(initial);
    setBaseline(initial);
    setErrors({});
    setSubmitError(null);
  }, [open, initialItem, courses]);

  const { requestClose, confirmingDiscard, confirmDiscard, cancelDiscard } = useDirtyClose(
    values,
    baseline,
    onClose,
  );
  const dialogRef = useModalA11y<HTMLDivElement>(open, requestClose);

  if (!open) return null;

  const selectedCourse = courses.find((c) => c.id === values.courseId);
  const recurringPreview =
    repeatEnabled && !initialItem && values.dueDate
      ? generateRecurringInstances(
          values.dueDate,
          { frequency: repeatFrequency, occurrences: repeatOccurrences },
          selectedCourse?.skipDates ?? [],
        )
      : [];
  const recurringShiftedCount = recurringPreview.filter((i) => i.shifted).length;

  const updateField = <K extends keyof ScheduleItemFormValues>(
    key: K,
    value: ScheduleItemFormValues[K],
  ) => {
    setValues((s) => ({ ...s, [key]: value }));
    setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const result = scheduleItemFormSchema.safeParse(values);
    if (!result.success) {
      const fieldErrors: Partial<Record<keyof ScheduleItemFormValues, string>> = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0] as keyof ScheduleItemFormValues;
        fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    setSubmitError(null);
    setSubmitting(true);
    try {
      if (repeatEnabled && !initialItem) {
        // Sequential, not Promise.all: each call goes through the same
        // onSubmit the parent already uses for a single task (optimistic
        // dispatch + a Firestore write per call) - awaiting one at a time
        // keeps that write-ordering the same a student would get by
        // manually adding each instance, just without the manual part.
        for (const instance of recurringPreview) {
          await onSubmit({ ...result.data, dueDate: instance.dueDate });
        }
      } else {
        await onSubmit(result.data);
      }
      onClose();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to save task. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="task-form-title"
      onClick={requestClose}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="relative w-full max-w-md outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <Card accent="none">
          {confirmingDiscard ? (
            <DiscardConfirmCard
              title="Discard unsaved changes?"
              description="You have changes to this task that haven't been saved."
              onCancel={cancelDiscard}
              onConfirm={confirmDiscard}
            />
          ) : (
            <>
              <CardHeader>
                <CardTitle id="task-form-title">{initialItem ? 'Edit Task' : 'Add Task'}</CardTitle>
                <CardDescription>
                  {initialItem
                    ? 'Update this task’s details.'
                    : 'Add an assignment, exam, or task.'}
                </CardDescription>
              </CardHeader>
              <form onSubmit={handleSubmit}>
                <CardContent className="space-y-4">
                  {submitError && (
                    <div className="rounded-lg border border-load-critical/30 bg-load-critical/10 px-3 py-2 text-sm text-load-critical">
                      {submitError}
                    </div>
                  )}

                  {courses.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Add a course first before creating tasks for it.
                    </p>
                  ) : (
                    <>
                      <Field
                        id="title"
                        label="Title"
                        value={values.title}
                        error={errors.title}
                        onChange={(v) => updateField('title', v)}
                        placeholder="Programming Assignment 1"
                      />

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <label htmlFor="courseId" className="text-sm font-medium text-foreground">
                            Course
                          </label>
                          <select
                            id="courseId"
                            value={values.courseId}
                            onChange={(e) => updateField('courseId', e.target.value)}
                            className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                          >
                            {courses.map((course) => (
                              <option key={course.id} value={course.id}>
                                {course.code}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-1.5">
                          <label htmlFor="type" className="text-sm font-medium text-foreground">
                            Type
                          </label>
                          <select
                            id="type"
                            value={values.type}
                            onChange={(e) => updateField('type', e.target.value as AssignmentType)}
                            className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                          >
                            {TYPE_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <Field
                          id="dueDate"
                          label="Due Date"
                          type="date"
                          value={values.dueDate}
                          error={errors.dueDate}
                          onChange={(v) => updateField('dueDate', v)}
                        />
                        <Field
                          id="estimatedHours"
                          label="Est. Hours"
                          type="number"
                          value={values.estimatedHours ?? ''}
                          error={errors.estimatedHours}
                          onChange={(v) => updateField('estimatedHours', v)}
                          placeholder="3"
                        />
                      </div>

                      {!initialItem && (
                        <div className="space-y-2 rounded-lg border border-border p-3">
                          <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                            <input
                              type="checkbox"
                              checked={repeatEnabled}
                              onChange={(e) => setRepeatEnabled(e.target.checked)}
                              className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                            />
                            Repeat this task
                          </label>
                          {repeatEnabled && (
                            <>
                              <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                  <label
                                    htmlFor="repeatFrequency"
                                    className="text-sm font-medium text-foreground"
                                  >
                                    Frequency
                                  </label>
                                  <select
                                    id="repeatFrequency"
                                    value={repeatFrequency}
                                    onChange={(e) =>
                                      setRepeatFrequency(e.target.value as RecurrenceFrequency)
                                    }
                                    className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                                  >
                                    {REPEAT_FREQUENCY_OPTIONS.map((opt) => (
                                      <option key={opt.value} value={opt.value}>
                                        {opt.label}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                <div className="space-y-1.5">
                                  <label
                                    htmlFor="repeatOccurrences"
                                    className="text-sm font-medium text-foreground"
                                  >
                                    Occurrences
                                  </label>
                                  <input
                                    id="repeatOccurrences"
                                    type="number"
                                    min={2}
                                    max={52}
                                    value={repeatOccurrences}
                                    onChange={(e) =>
                                      setRepeatOccurrences(
                                        Math.min(52, Math.max(2, Number(e.target.value) || 2)),
                                      )
                                    }
                                    className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                                  />
                                </div>
                              </div>
                              {values.dueDate && (
                                <p className="text-xs text-muted-foreground">
                                  Creates {recurringPreview.length} tasks, starting {values.dueDate}
                                  {recurringShiftedCount > 0 && (
                                    <>
                                      {' '}
                                      - {recurringShiftedCount} shifted off a skipped class date for
                                      this course
                                    </>
                                  )}
                                  .
                                </p>
                              )}
                            </>
                          )}
                        </div>
                      )}

                      {values.type === 'reading' && (
                        <ReadingLoadEstimator
                          pages={readingPages}
                          density={readingDensity}
                          onPagesChange={setReadingPages}
                          onDensityChange={setReadingDensity}
                          onUseEstimate={(hours) => updateField('estimatedHours', hours.toString())}
                        />
                      )}

                      <div className="space-y-1.5">
                        <span className="text-sm font-medium text-foreground">Priority</span>
                        <div className="flex gap-2">
                          {PRIORITY_OPTIONS.map((opt) => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => updateField('priority', opt.value)}
                              className={cn(
                                'flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
                                values.priority === opt.value
                                  ? 'border-primary bg-primary/10 text-primary'
                                  : 'border-border text-muted-foreground hover:bg-accent',
                              )}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {initialItem && (
                        <div className="space-y-1.5">
                          <label htmlFor="progress" className="text-sm font-medium text-foreground">
                            Progress
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              id="progress"
                              type="number"
                              min={0}
                              max={100}
                              step={5}
                              value={values.progress ?? ''}
                              placeholder="0"
                              onChange={(e) => updateField('progress', e.target.value)}
                              className={cn(
                                'w-24 rounded-lg border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary',
                                errors.progress ? 'border-destructive' : 'border-border',
                              )}
                            />
                            <span className="text-sm text-muted-foreground">% complete</span>
                          </div>
                          {errors.progress && (
                            <p className="text-xs text-destructive">{errors.progress}</p>
                          )}
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-3">
                        <Field
                          id="gradeWeight"
                          label="Grade Weight (%)"
                          type="number"
                          value={values.gradeWeight ?? ''}
                          error={errors.gradeWeight}
                          onChange={(v) => updateField('gradeWeight', v)}
                          placeholder="Optional"
                        />
                        <Field
                          id="gradeCategory"
                          label="Grade Category"
                          value={values.gradeCategory ?? ''}
                          error={errors.gradeCategory}
                          onChange={(v) => updateField('gradeCategory', v)}
                          placeholder="e.g. Homework"
                        />
                      </div>

                      <Field
                        id="assignedTo"
                        label="Assigned To"
                        value={values.assignedTo ?? ''}
                        error={errors.assignedTo}
                        onChange={(v) => updateField('assignedTo', v)}
                        placeholder="e.g. Priya, or You - visible only to you"
                      />

                      <Field
                        id="notes"
                        label="Notes"
                        value={values.notes ?? ''}
                        error={errors.notes}
                        onChange={(v) => updateField('notes', v)}
                        placeholder="Optional"
                      />
                    </>
                  )}
                </CardContent>
                <CardFooter className="justify-end gap-2">
                  <button
                    type="button"
                    onClick={requestClose}
                    className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-accent transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || courses.length === 0}
                    className="rounded-lg bg-primary text-primary-foreground text-sm font-semibold px-4 py-2 transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    {submitting
                      ? 'Saving...'
                      : initialItem
                        ? 'Save Changes'
                        : repeatEnabled
                          ? `Add ${recurringPreview.length} Tasks`
                          : 'Add Task'}
                  </button>
                </CardFooter>
              </form>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

interface FieldProps {
  id: string;
  label: string;
  value: string;
  error?: string;
  placeholder?: string;
  type?: string;
  onChange: (value: string) => void;
}

interface ReadingLoadEstimatorProps {
  pages: string;
  density: ReadingDensity;
  onPagesChange: (value: string) => void;
  onDensityChange: (value: ReadingDensity) => void;
  onUseEstimate: (hours: number) => void;
}

/** Part B: lets a student enter a page count instead of guessing at
 * Est. Hours for a reading assignment - "Use estimate" fills the field but
 * never overwrites it silently, so a manual estimate is never clobbered. */
function ReadingLoadEstimator({
  pages,
  density,
  onPagesChange,
  onDensityChange,
  onUseEstimate,
}: ReadingLoadEstimatorProps) {
  const pageCount = Number(pages);
  const estimate =
    pages.trim() !== '' && Number.isFinite(pageCount) && pageCount > 0
      ? estimateReadingHours(pageCount, density)
      : null;

  return (
    <div className="space-y-2 rounded-lg border border-border bg-accent/40 p-3">
      <span className="text-sm font-medium text-foreground">Reading load estimator</span>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label htmlFor="readingPages" className="text-xs font-medium text-muted-foreground">
            Pages
          </label>
          <input
            id="readingPages"
            type="number"
            min={0}
            value={pages}
            placeholder="e.g. 40"
            onChange={(e) => onPagesChange(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="readingDensity" className="text-xs font-medium text-muted-foreground">
            Density
          </label>
          <select
            id="readingDensity"
            value={density}
            onChange={(e) => onDensityChange(e.target.value as ReadingDensity)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {READING_DENSITY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        {READING_DENSITY_OPTIONS.find((opt) => opt.value === density)?.helper}
      </p>
      {estimate !== null && (
        <div className="flex items-center justify-between gap-2 pt-1">
          <span className="text-sm text-foreground">
            Estimated: <span className="font-semibold">{estimate}h</span>
          </span>
          <button
            type="button"
            onClick={() => onUseEstimate(estimate)}
            className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary/20"
          >
            Use estimate
          </button>
        </div>
      )}
    </div>
  );
}

function Field({ id, label, value, error, placeholder, type = 'text', onChange }: FieldProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          'w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary',
          error ? 'border-destructive' : 'border-border',
        )}
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
