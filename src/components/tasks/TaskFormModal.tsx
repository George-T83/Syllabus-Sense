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
  const [errors, setErrors] = useState<Partial<Record<keyof ScheduleItemFormValues, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setValues(
      initialItem
        ? {
            title: initialItem.title,
            type: initialItem.type,
            courseId: initialItem.courseId,
            dueDate: initialItem.dueDate.slice(0, 10),
            estimatedHours: initialItem.estimatedHours?.toString() ?? '',
            priority: initialItem.priority ?? 'medium',
            notes: initialItem.notes ?? '',
          }
        : emptyValues(courses[0]?.id ?? ''),
    );
    setErrors({});
    setSubmitError(null);
  }, [open, initialItem, courses]);

  if (!open) return null;

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
      await onSubmit(result.data);
      onClose();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to save task. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="task-form-title"
      onClick={onClose}
    >
      <div className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <Card>
          <CardHeader>
            <CardTitle id="task-form-title">{initialItem ? 'Edit Task' : 'Add Task'}</CardTitle>
            <CardDescription>
              {initialItem ? 'Update this task’s details.' : 'Add an assignment, exam, or task.'}
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              {submitError && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
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
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
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
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
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
                onClick={onClose}
                className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-accent transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || courses.length === 0}
                className="rounded-lg bg-primary text-primary-foreground text-sm font-semibold px-4 py-2 transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {submitting ? 'Saving...' : initialItem ? 'Save Changes' : 'Add Task'}
              </button>
            </CardFooter>
          </form>
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
