'use client';

import { useEffect, useRef, useState, FormEvent } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/Card';
import { CardActionButton } from '@/components/ui/CardAction';
import { courseFormSchema, type CourseFormValues } from '@/lib/validation/course';
import type { Course, CourseModality, MeetingTime } from '@/types/schedule';
import { cn } from '@/lib/utils';
import { useModalA11y } from '@/hooks/useModalA11y';
import { useDirtyClose } from '@/hooks/useDirtyClose';
import { useAppState } from '@/context/AppStateContext';
import { COURSE_COLOR_PRESETS, pickNextCourseColor } from '@/lib/courseColors';
import { COURSE_ICON_PRESETS, DEFAULT_COURSE_ICON } from '@/lib/courseIcons';
import { CourseIconGlyph } from '@/components/ui/CourseIconGlyph';

const isCustomColor = (color: string) => color.startsWith('#');

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
  color: COURSE_COLOR_PRESETS[0].value,
  icon: DEFAULT_COURSE_ICON,
  modality: undefined,
  meetingTimes: [],
  skipDates: [],
};

export function CourseFormModal({ open, onClose, onSubmit, initialCourse }: CourseFormModalProps) {
  const { state } = useAppState();
  const [values, setValues] = useState<CourseFormValues>(emptyValues);
  const [baseline, setBaseline] = useState<CourseFormValues>(emptyValues);
  const [errors, setErrors] = useState<Partial<Record<keyof CourseFormValues, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Latest courses without being a dependency below - the effect should only
  // recompute a fresh course's default color when the modal actually opens,
  // not every time Firestore syncs a change while it's sitting open with a
  // half-filled form.
  const coursesRef = useRef(state.courses);
  coursesRef.current = state.courses;

  useEffect(() => {
    if (!open) return;
    const initial: CourseFormValues = initialCourse
      ? {
          code: initialCourse.code,
          title: initialCourse.title,
          instructor: initialCourse.instructor ?? '',
          term: initialCourse.term ?? '',
          color: initialCourse.color ?? COURSE_COLOR_PRESETS[0].value,
          icon: initialCourse.icon ?? DEFAULT_COURSE_ICON,
          modality: initialCourse.modality,
          meetingTimes: initialCourse.meetingTimes ?? [],
          skipDates: initialCourse.skipDates ?? [],
        }
      : // A fresh course defaults to whichever preset is least represented
        // among the user's existing courses, so a student with 8+ courses
        // doesn't land on the same blue every time.
        { ...emptyValues, color: pickNextCourseColor(coursesRef.current) };
    setValues(initial);
    setBaseline(initial);
    setErrors({});
    setSubmitError(null);
  }, [open, initialCourse]);

  const { requestClose, confirmingDiscard, confirmDiscard, cancelDiscard } = useDirtyClose(
    values,
    baseline,
    onClose,
  );
  const dialogRef = useModalA11y<HTMLDivElement>(open, requestClose);

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

  const skipDates = values.skipDates ?? [];

  const addSkipDate = () => {
    setValues((s) => ({ ...s, skipDates: [...(s.skipDates ?? []), ''] }));
  };

  const removeSkipDate = (index: number) => {
    setValues((s) => ({
      ...s,
      skipDates: (s.skipDates ?? []).filter((_, i) => i !== index),
    }));
  };

  const updateSkipDate = (index: number, value: string) => {
    setValues((s) => ({
      ...s,
      skipDates: (s.skipDates ?? []).map((d, i) => (i === index ? value : d)),
    }));
    setErrors((e) => (e.skipDates ? { ...e, skipDates: undefined } : e));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    // A skip-date row the user added but hasn't picked a date for yet
    // shouldn't block submission - drop empty rows rather than fail
    // validation on a placeholder.
    const result = courseFormSchema.safeParse({
      ...values,
      skipDates: (values.skipDates ?? []).filter((d) => d.trim().length > 0),
    });
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
      onClick={requestClose}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="relative w-full max-w-md outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        {confirmingDiscard && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-background/90 p-4 backdrop-blur-sm">
            <div className="w-full max-w-xs space-y-3 rounded-xl border border-border bg-card p-4 shadow-lg">
              <p className="text-sm font-medium text-foreground">Discard unsaved changes?</p>
              <p className="text-xs text-muted-foreground">
                You have changes to this course that haven&apos;t been saved.
              </p>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={cancelDiscard}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent"
                >
                  Keep editing
                </button>
                <button
                  type="button"
                  onClick={confirmDiscard}
                  className="rounded-lg bg-destructive px-3 py-1.5 text-xs font-semibold text-destructive-foreground transition-colors hover:bg-destructive/90"
                >
                  Discard
                </button>
              </div>
            </div>
          </div>
        )}
        <Card accent="none">
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
                <div className="rounded-lg border border-load-critical/30 bg-load-critical/10 px-3 py-2 text-sm text-load-critical">
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
                <div className="flex flex-wrap gap-2">
                  {COURSE_COLOR_PRESETS.map((preset) => (
                    <button
                      key={preset.value}
                      type="button"
                      aria-label={`Select ${preset.label ?? preset.value} color`}
                      aria-pressed={values.color === preset.value}
                      onClick={() => setValues((s) => ({ ...s, color: preset.value }))}
                      className={cn(
                        'h-7 w-7 rounded-full transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
                        preset.value,
                        values.color === preset.value
                          ? 'ring-2 ring-offset-2 ring-primary ring-offset-card scale-110'
                          : 'hover:scale-110',
                      )}
                    />
                  ))}
                  <label
                    aria-label="Custom color"
                    title="Custom color"
                    className={cn(
                      'relative flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full border border-dashed border-border text-muted-foreground transition-transform hover:scale-110',
                      isCustomColor(values.color) &&
                        'border-solid ring-2 ring-offset-2 ring-primary ring-offset-card scale-110',
                    )}
                    style={
                      isCustomColor(values.color)
                        ? { backgroundColor: values.color, borderStyle: 'solid' }
                        : undefined
                    }
                  >
                    {!isCustomColor(values.color) && (
                      <svg
                        className="h-3.5 w-3.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                      </svg>
                    )}
                    <input
                      type="color"
                      className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                      value={isCustomColor(values.color) ? values.color : '#7c3aed'}
                      onChange={(e) => setValues((s) => ({ ...s, color: e.target.value }))}
                    />
                  </label>
                </div>
              </div>

              <div className="space-y-1.5">
                <span className="text-sm font-medium text-foreground">Icon</span>
                <div className="flex flex-wrap gap-2">
                  {COURSE_ICON_PRESETS.map((preset) => (
                    <button
                      key={preset.value}
                      type="button"
                      title={preset.label}
                      aria-label={preset.label}
                      onClick={() => setValues((s) => ({ ...s, icon: preset.value }))}
                      className={cn(
                        'flex h-8 w-8 items-center justify-center rounded-full border text-muted-foreground transition-colors',
                        values.icon === preset.value
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border hover:bg-accent',
                      )}
                    >
                      <CourseIconGlyph icon={preset.value} className="h-4 w-4" />
                    </button>
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
                  <CardActionButton variant="solid" withPlus onClick={addMeetingTime}>
                    Add meeting time
                  </CardActionButton>
                </div>
                {meetingTimes.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No recurring class sessions yet — add one so it shows up on the calendar.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {meetingTimes.map((meeting, index) => {
                      const timeInvalid =
                        !!meeting.startTime &&
                        !!meeting.endTime &&
                        meeting.endTime <= meeting.startTime;
                      return (
                        <div key={index} className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-2">
                            <select
                              aria-label={`Meeting ${index + 1} day of week`}
                              value={meeting.dayOfWeek}
                              onChange={(e) =>
                                updateMeetingTime(index, { dayOfWeek: Number(e.target.value) })
                              }
                              className="rounded-md border border-border bg-input px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
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
                              onChange={(e) =>
                                updateMeetingTime(index, { startTime: e.target.value })
                              }
                              className={cn(
                                'rounded-md border bg-background px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary',
                                timeInvalid ? 'border-destructive' : 'border-border',
                              )}
                            />
                            <span className="text-xs text-muted-foreground">to</span>
                            <input
                              aria-label={`Meeting ${index + 1} end time`}
                              type="time"
                              value={meeting.endTime}
                              onChange={(e) =>
                                updateMeetingTime(index, { endTime: e.target.value })
                              }
                              className={cn(
                                'rounded-md border bg-background px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary',
                                timeInvalid ? 'border-destructive' : 'border-border',
                              )}
                            />
                            <input
                              aria-label={`Meeting ${index + 1} location`}
                              value={meeting.location ?? ''}
                              onChange={(e) =>
                                updateMeetingTime(index, { location: e.target.value })
                              }
                              placeholder="Location (optional)"
                              className="min-w-[9rem] flex-1 rounded-md border border-border bg-input px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
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
                          {timeInvalid && (
                            <p className="text-xs text-destructive" role="alert">
                              End time must be after start time.
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                {errors.meetingTimes && (
                  <p className="text-xs text-destructive">{errors.meetingTimes}</p>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">
                    Skip dates (holidays &amp; breaks)
                  </span>
                  <CardActionButton variant="solid" withPlus onClick={addSkipDate}>
                    Add skip date
                  </CardActionButton>
                </div>
                {skipDates.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No skipped dates yet — add one to hide a weekly meeting on a holiday or break.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {skipDates.map((date, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-2 rounded-lg border border-border p-2"
                      >
                        <input
                          aria-label={`Skip date ${index + 1}`}
                          type="date"
                          value={date}
                          onChange={(e) => updateSkipDate(index, e.target.value)}
                          className="flex-1 rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                        <button
                          type="button"
                          onClick={() => removeSkipDate(index)}
                          aria-label={`Remove skip date ${index + 1}`}
                          className="rounded-md px-1.5 py-1 text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {errors.skipDates && <p className="text-xs text-destructive">{errors.skipDates}</p>}
              </div>
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
                disabled={
                  submitting ||
                  meetingTimes.some((m) => !!m.startTime && !!m.endTime && m.endTime <= m.startTime)
                }
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
