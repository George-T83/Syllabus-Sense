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
import { courseFormSchema, type CourseFormValues } from '@/lib/validation/course';
import type { Course, CourseModality, MeetingTime } from '@/types/schedule';
import { cn } from '@/lib/utils';
import { useModalA11y } from '@/hooks/useModalA11y';

const COURSE_COLORS = [
  'bg-blue-500',
  'bg-green-500',
  'bg-purple-500',
  'bg-red-500',
  'bg-orange-500',
  'bg-teal-500',
];

const MODALITY_OPTIONS: { value: CourseModality; label: string }[] = [
  { value: 'in-person', label: 'In-person' },
  { value: 'online', label: 'Online' },
  { value: 'hybrid', label: 'Hybrid' },
];

const WEEKDAY_OPTIONS = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
];

const emptyMeetingTime: MeetingTime = {
  dayOfWeek: 1,
  startTime: '09:00',
  endTime: '10:15',
  location: '',
};

export interface CourseFormModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: CourseFormValues) => Promise<void>;
  /** Present when editing an existing course; absent when creating a new one. */
  initialCourse?: Course;
}

const emptyValues: CourseFormValues = {
  code: '',
  title: '',
  instructor: '',
  term: '',
  color: COURSE_COLORS[0],
  modality: undefined,
  meetingTimes: [],
};

export function CourseFormModal({ open, onClose, onSubmit, initialCourse }: CourseFormModalProps) {
  const [values, setValues] = useState<CourseFormValues>(emptyValues);
  const [errors, setErrors] = useState<Partial<Record<keyof CourseFormValues, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setValues(
      initialCourse
        ? {
            code: initialCourse.code,
            title: initialCourse.title,
            instructor: initialCourse.instructor ?? '',
            term: initialCourse.term ?? '',
            color: initialCourse.color ?? COURSE_COLORS[0],
            modality: initialCourse.modality,
            meetingTimes: initialCourse.meetingTimes ?? [],
          }
        : emptyValues,
    );
    setErrors({});
    setSubmitError(null);
  }, [open, initialCourse]);

  const dialogRef = useModalA11y<HTMLDivElement>(open, onClose);

  if (!open) return null;

  const updateField = (key: keyof CourseFormValues, value: string) => {
    setValues((s) => ({ ...s, [key]: value }));
    setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));
  };

  const meetingTimes = values.meetingTimes ?? [];

  const addMeetingTime = () => {
    setValues((s) => ({
      ...s,
      meetingTimes: [...(s.meetingTimes ?? []), { ...emptyMeetingTime }],
    }));
  };

  const removeMeetingTime = (index: number) => {
    setValues((s) => ({
      ...s,
      meetingTimes: (s.meetingTimes ?? []).filter((_, i) => i !== index),
    }));
  };

  const updateMeetingTime = (index: number, patch: Partial<MeetingTime>) => {
    setValues((s) => ({
      ...s,
      meetingTimes: (s.meetingTimes ?? []).map((m, i) => (i === index ? { ...m, ...patch } : m)),
    }));
    setErrors((e) => (e.meetingTimes ? { ...e, meetingTimes: undefined } : e));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const result = courseFormSchema.safeParse(values);
    if (!result.success) {
      const fieldErrors: Partial<Record<keyof CourseFormValues, string>> = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0] as keyof CourseFormValues;
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
      setSubmitError(
        err instanceof Error ? err.message : 'Failed to save course. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="course-form-title"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="w-full max-w-md outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <Card>
          <CardHeader>
            <CardTitle id="course-form-title">
              {initialCourse ? 'Edit Course' : 'Add Course'}
            </CardTitle>
            <CardDescription>
              {initialCourse ? 'Update this course’s details.' : 'Add a course to track its work.'}
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              {submitError && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {submitError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <Field
                  id="code"
                  label="Course Code"
                  value={values.code}
                  error={errors.code}
                  onChange={(v) => updateField('code', v)}
                  placeholder="CSCI 213"
                />
                <Field
                  id="term"
                  label="Term"
                  value={values.term ?? ''}
                  error={errors.term}
                  onChange={(v) => updateField('term', v)}
                  placeholder="Fall 2026"
                />
              </div>

              <Field
                id="title"
                label="Course Title"
                value={values.title}
                error={errors.title}
                onChange={(v) => updateField('title', v)}
                placeholder="Computer Science I"
              />

              <Field
                id="instructor"
                label="Instructor"
                value={values.instructor ?? ''}
                error={errors.instructor}
                onChange={(v) => updateField('instructor', v)}
                placeholder="Dr. Ada Lovelace"
              />

              <div className="space-y-1.5">
                <span className="text-sm font-medium text-foreground">Color</span>
                <div className="flex gap-2">
                  {COURSE_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      aria-label={color}
                      onClick={() => setValues((s) => ({ ...s, color }))}
                      className={cn(
                        'h-7 w-7 rounded-full transition-transform',
                        color,
                        values.color === color
                          ? 'ring-2 ring-offset-2 ring-primary ring-offset-card scale-110'
                          : 'hover:scale-110',
                      )}
                    />
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <span className="text-sm font-medium text-foreground">Modality</span>
                <div className="flex gap-2">
                  {MODALITY_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() =>
                        setValues((s) => ({
                          ...s,
                          modality: s.modality === opt.value ? undefined : opt.value,
                        }))
                      }
                      className={cn(
                        'rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
                        values.modality === opt.value
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border text-muted-foreground hover:bg-accent',
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">Weekly meetings</span>
                  <button
                    type="button"
                    onClick={addMeetingTime}
                    className="text-xs font-semibold text-primary hover:underline"
                  >
                    + Add meeting time
                  </button>
                </div>
                {meetingTimes.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No recurring class sessions yet — add one so it shows up on the calendar.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {meetingTimes.map((meeting, index) => (
                      <div
                        key={index}
                        className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-2"
                      >
                        <select
                          aria-label={`Meeting ${index + 1} day of week`}
                          value={meeting.dayOfWeek}
                          onChange={(e) =>
                            updateMeetingTime(index, { dayOfWeek: Number(e.target.value) })
                          }
                          className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                        >
                          {WEEKDAY_OPTIONS.map((d) => (
                            <option key={d.value} value={d.value}>
                              {d.label}
                            </option>
                          ))}
                        </select>
                        <input
                          aria-label={`Meeting ${index + 1} start time`}
                          type="time"
                          value={meeting.startTime}
                          onChange={(e) => updateMeetingTime(index, { startTime: e.target.value })}
                          className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                        <span className="text-xs text-muted-foreground">to</span>
                        <input
                          aria-label={`Meeting ${index + 1} end time`}
                          type="time"
                          value={meeting.endTime}
                          onChange={(e) => updateMeetingTime(index, { endTime: e.target.value })}
                          className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                        <input
                          aria-label={`Meeting ${index + 1} location`}
                          value={meeting.location ?? ''}
                          onChange={(e) => updateMeetingTime(index, { location: e.target.value })}
                          placeholder="Location (optional)"
                          className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                        <button
                          type="button"
                          onClick={() => removeMeetingTime(index)}
                          aria-label={`Remove meeting ${index + 1}`}
                          className="rounded-md px-1.5 py-1 text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {errors.meetingTimes && (
                  <p className="text-xs text-destructive">{errors.meetingTimes}</p>
                )}
              </div>
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
                disabled={submitting}
                className="rounded-lg bg-primary text-primary-foreground text-sm font-semibold px-4 py-2 transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {submitting ? 'Saving...' : initialCourse ? 'Save Changes' : 'Add Course'}
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
  onChange: (value: string) => void;
}

function Field({ id, label, value, error, placeholder, onChange }: FieldProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
      </label>
      <input
        id={id}
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
