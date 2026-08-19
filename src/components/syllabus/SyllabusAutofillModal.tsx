'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/Card';
import { validateSyllabusFile } from '@/lib/validation/syllabusFile';
import { createCourseWithScheduleItems } from '@/lib/firestore/courses';
import { courseFormSchema } from '@/lib/validation/course';
import { scheduleItemFormSchema } from '@/lib/validation/scheduleItem';
import { useModalA11y } from '@/hooks/useModalA11y';
import { useAppState } from '@/context/AppStateContext';
import { useAuth } from '@/context/AuthContext';
import { COURSE_COLOR_PRESETS, pickNextCourseColor } from '@/lib/courseColors';
import { cn } from '@/lib/utils';
import type {
  ExtractedMeetingTime,
  ExtractedScheduleItem,
  SyllabusExtractionResult,
} from '@/types/extraction';
import type {
  AssignmentType,
  Course,
  CourseModality,
  MeetingTime,
  ScheduleItem,
} from '@/types/schedule';

const WEEKDAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const TYPE_LABELS: Record<AssignmentType, string> = {
  assignment: 'Assignment',
  exam: 'Exam',
  quiz: 'Quiz',
  project: 'Project',
  reading: 'Reading',
  other: 'Other',
};

type Step = 'upload' | 'extracting' | 'review' | 'saving';

interface DraftItem extends ExtractedScheduleItem {
  /** Local id for React keys/editing - not persisted as-is. */
  key: string;
  /** Whether this item will be created when the user confirms. Items with
   * no resolvable date start unchecked and locked until a date is filled
   * in, so nothing with a fabricated date silently lands on the calendar. */
  include: boolean;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export interface SyllabusAutofillModalProps {
  open: boolean;
  onClose: () => void;
}

export function SyllabusAutofillModal({ open, onClose }: SyllabusAutofillModalProps) {
  const { state, dispatch } = useAppState();
  const { user } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState<Step>('upload');
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [course, setCourse] = useState<{
    code: string;
    title: string;
    instructor: string;
    term: string;
    color: string;
    modality: CourseModality | undefined;
    meetingTimes: MeetingTime[];
    materials: string[];
    skipDates: string[];
    notes: string;
  } | null>(null);
  const [items, setItems] = useState<DraftItem[]>([]);
  const [unresolved, setUnresolved] = useState<string[]>([]);

  const reset = () => {
    setStep('upload');
    setFile(null);
    setError(null);
    setCourse(null);
    setItems([]);
    setUnresolved([]);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  // Escape shouldn't interrupt an in-flight extraction or save.
  const dialogRef = useModalA11y<HTMLDivElement>(
    open && step !== 'extracting' && step !== 'saving',
    handleClose,
  );

  if (!open) return null;

  const handleFile = async (selected: File) => {
    const result = validateSyllabusFile(selected);
    if (!result.valid) {
      setError(result.error ?? 'Invalid file.');
      return;
    }
    setError(null);
    setFile(selected);
    setStep('extracting');

    try {
      if (!user) throw new Error('You must be signed in.');
      const idToken = await user.getIdToken();
      const fileBase64 = await fileToBase64(selected);
      const res = await fetch('/api/syllabus/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ fileBase64, fileName: selected.name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Extraction failed.');

      const result: SyllabusExtractionResult = data.result;
      setCourse({
        code: result.course.code,
        title: result.course.title,
        instructor: result.course.instructor ?? '',
        term: result.course.term ?? '',
        // Auto-assigned to whichever preset is least represented among the
        // user's existing courses, so extracted courses don't all default
        // to the same blue - the user can still change it on the review
        // screen before confirming.
        color: pickNextCourseColor(state.courses),
        modality: result.course.modality ?? undefined,
        meetingTimes: result.course.meetingTimes.map((m: ExtractedMeetingTime) => ({
          dayOfWeek: m.dayOfWeek,
          startTime: m.startTime,
          endTime: m.endTime,
          location: m.location ?? '',
        })),
        materials: result.course.materials,
        skipDates: result.course.skipDates,
        notes: result.course.notes ?? '',
      });
      setItems(
        result.scheduleItems.map((item, i) => ({
          ...item,
          key: `${i}-${item.title}`,
          include: item.dueDate !== null,
        })),
      );
      setUnresolved(result.unresolved);
      setStep('review');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Extraction failed. Please try again.');
      setStep('upload');
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) handleFile(dropped);
  };

  const updateItem = (key: string, patch: Partial<DraftItem>) => {
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...patch } : it)));
  };

  const updateMeeting = (index: number, patch: Partial<MeetingTime>) => {
    setCourse((c) => {
      if (!c) return c;
      const meetingTimes = c.meetingTimes.map((m, i) => (i === index ? { ...m, ...patch } : m));
      return { ...c, meetingTimes };
    });
  };

  const removeMeeting = (index: number) => {
    setCourse((c) =>
      c ? { ...c, meetingTimes: c.meetingTimes.filter((_, i) => i !== index) } : c,
    );
  };

  const updateMaterial = (index: number, value: string) => {
    setCourse((c) => {
      if (!c) return c;
      const materials = c.materials.map((m, i) => (i === index ? value : m));
      return { ...c, materials };
    });
  };

  const removeMaterial = (index: number) => {
    setCourse((c) => (c ? { ...c, materials: c.materials.filter((_, i) => i !== index) } : c));
  };

  const handleConfirm = async () => {
    if (!course || !user) return;

    // The review screen lets the user freely edit whatever Claude extracted,
    // so re-validate here with the same schemas the manual course/task forms
    // use - a hand-typed 500-character title shouldn't reach Firestore just
    // because it arrived via the autofiller instead of the regular form.
    const courseCheck = courseFormSchema.safeParse(course);
    if (!courseCheck.success) {
      setError(courseCheck.error.issues[0]?.message ?? 'Check the course details above.');
      return;
    }
    for (const it of items) {
      if (!it.include || !it.dueDate) continue;
      const itemCheck = scheduleItemFormSchema.safeParse({
        title: it.title,
        type: it.type,
        courseId: 'pending',
        dueDate: it.dueDate,
        priority: it.highStakes ? 'high' : 'medium',
        notes: it.notes ?? undefined,
      });
      if (!itemCheck.success) {
        setError(
          `"${it.title || 'Untitled item'}": ${itemCheck.error.issues[0]?.message ?? 'Check this item.'}`,
        );
        return;
      }
    }

    setStep('saving');
    setError(null);
    try {
      const newCourse: Course = {
        id: crypto.randomUUID(),
        code: course.code,
        title: course.title,
        color: course.color,
        source: 'ai',
        ...(course.instructor ? { instructor: course.instructor } : {}),
        ...(course.term ? { term: course.term } : {}),
        ...(course.modality ? { modality: course.modality } : {}),
        ...(course.meetingTimes.length ? { meetingTimes: course.meetingTimes } : {}),
        ...(course.materials.length ? { materials: course.materials.filter(Boolean) } : {}),
        ...(course.skipDates.length ? { skipDates: course.skipDates } : {}),
        ...(course.notes ? { notes: course.notes } : {}),
      };
      const included = items.filter((it) => it.include && it.dueDate);
      const scheduleItems: ScheduleItem[] = included.map((it) => ({
        id: crypto.randomUUID(),
        courseId: newCourse.id,
        title: it.title,
        type: it.type,
        dueDate: new Date(`${it.dueDate}T23:59:00`).toISOString(),
        completed: false,
        priority: it.highStakes ? 'high' : 'medium',
        source: 'ai',
        ...(it.dateConfidence === 'approximate' ? { dateConfidence: 'approximate' as const } : {}),
        ...(it.highStakes ? { highStakes: true } : {}),
        ...(it.gradeWeight != null ? { gradeWeight: it.gradeWeight } : {}),
        ...(it.gradeCategory ? { gradeCategory: it.gradeCategory } : {}),
        ...(it.notes ? { notes: it.notes } : {}),
      }));

      // Single atomic batch: the course and all its schedule items land
      // together or not at all, instead of the course succeeding while a
      // mid-loop failure leaves some assignments missing.
      await createCourseWithScheduleItems(user.uid, newCourse, scheduleItems, dispatch);

      if (file) {
        try {
          await saveSyllabusPdf(user.uid, newCourse.id, file);
        } catch {
          // Non-fatal: the course and tasks are already saved. The user can
          // re-upload the PDF from the course page if this fails.
        }
      }

      handleClose();
      router.push(`/courses/${newCourse.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save. Please try again.');
      setStep('review');
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4 py-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="autofill-title"
      onClick={step === 'upload' ? handleClose : undefined}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="max-h-full w-full max-w-2xl overflow-y-auto outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <Card>
          <CardHeader>
            <CardTitle id="autofill-title">Autofill from Syllabus</CardTitle>
            <CardDescription>
              Upload a syllabus PDF or Word doc and review what Claude found before it&apos;s added.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {error && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}

            {step === 'upload' && (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragActive(true);
                }}
                onDragLeave={() => setDragActive(false)}
                onDrop={handleDrop}
                onClick={() => inputRef.current?.click()}
                role="button"
                tabIndex={0}
                className={cn(
                  'flex flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed px-4 py-10 text-center cursor-pointer transition-colors',
                  dragActive ? 'border-primary bg-primary/5' : 'border-border hover:bg-accent',
                )}
              >
                <span className="text-sm font-medium text-foreground">
                  Drop a syllabus PDF or Word doc here, or click to browse
                </span>
                <span className="text-xs text-muted-foreground">PDF or .docx, up to 10MB</span>
                <input
                  ref={inputRef}
                  type="file"
                  accept="application/pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  className="hidden"
                  onChange={(e) => {
                    const selected = e.target.files?.[0];
                    if (selected) handleFile(selected);
                    e.target.value = '';
                  }}
                />
              </div>
            )}

            {step === 'extracting' && (
              <div className="flex flex-col items-center justify-center gap-3 py-14">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <p className="text-sm text-muted-foreground">Reading your syllabus...</p>
              </div>
            )}

            {(step === 'review' || step === 'saving') && course && (
              <div className="space-y-6">
                <section className="space-y-3">
                  <h3 className="text-sm font-semibold text-foreground">Course</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <TextField
                      label="Code"
                      value={course.code}
                      onChange={(v) => setCourse((c) => c && { ...c, code: v })}
                    />
                    <TextField
                      label="Term"
                      value={course.term}
                      onChange={(v) => setCourse((c) => c && { ...c, term: v })}
                    />
                  </div>
                  <TextField
                    label="Title"
                    value={course.title}
                    onChange={(v) => setCourse((c) => c && { ...c, title: v })}
                  />
                  <TextField
                    label="Instructor"
                    value={course.instructor}
                    onChange={(v) => setCourse((c) => c && { ...c, instructor: v })}
                  />
                  <div className="flex flex-wrap gap-2">
                    {COURSE_COLOR_PRESETS.map((preset) => (
                      <button
                        key={preset.value}
                        type="button"
                        aria-label={preset.value}
                        onClick={() => setCourse((c) => c && { ...c, color: preset.value })}
                        className={cn(
                          'h-6 w-6 rounded-full transition-transform',
                          preset.value,
                          course.color === preset.value
                            ? 'ring-2 ring-offset-2 ring-primary ring-offset-card scale-110'
                            : 'hover:scale-110',
                        )}
                      />
                    ))}
                    <label
                      aria-label="Custom color"
                      title="Custom color"
                      className={cn(
                        'relative flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-full border border-dashed border-border text-muted-foreground transition-transform hover:scale-110',
                        course.color.startsWith('#') &&
                          'border-solid ring-2 ring-offset-2 ring-primary ring-offset-card scale-110',
                      )}
                      style={
                        course.color.startsWith('#')
                          ? { backgroundColor: course.color, borderStyle: 'solid' }
                          : undefined
                      }
                    >
                      {!course.color.startsWith('#') && (
                        <svg
                          className="h-3 w-3"
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
                        value={course.color.startsWith('#') ? course.color : '#7c3aed'}
                        onChange={(e) => setCourse((c) => c && { ...c, color: e.target.value })}
                      />
                    </label>
                  </div>
                </section>

                {course.meetingTimes.length > 0 && (
                  <section className="space-y-2">
                    <h3 className="text-sm font-semibold text-foreground">Meeting times</h3>
                    {course.meetingTimes.map((m, i) => (
                      <div
                        key={i}
                        className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-2 text-xs"
                      >
                        <select
                          value={m.dayOfWeek}
                          onChange={(e) => updateMeeting(i, { dayOfWeek: Number(e.target.value) })}
                          className="rounded-md border border-border bg-background px-2 py-1 text-foreground"
                        >
                          {WEEKDAY_ABBR.map((label, d) => (
                            <option key={d} value={d}>
                              {label}
                            </option>
                          ))}
                        </select>
                        <input
                          type="time"
                          value={m.startTime}
                          onChange={(e) => updateMeeting(i, { startTime: e.target.value })}
                          className="rounded-md border border-border bg-background px-2 py-1 text-foreground"
                        />
                        <span className="text-muted-foreground">to</span>
                        <input
                          type="time"
                          value={m.endTime}
                          onChange={(e) => updateMeeting(i, { endTime: e.target.value })}
                          className="rounded-md border border-border bg-background px-2 py-1 text-foreground"
                        />
                        <input
                          value={m.location ?? ''}
                          onChange={(e) => updateMeeting(i, { location: e.target.value })}
                          placeholder="Location"
                          className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1 text-foreground"
                        />
                        <button
                          type="button"
                          onClick={() => removeMeeting(i)}
                          className="rounded-md px-1.5 py-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </section>
                )}

                {course.materials.length > 0 && (
                  <section className="space-y-2">
                    <h3 className="text-sm font-semibold text-foreground">
                      Materials &amp; supplies
                    </h3>
                    <ul className="space-y-1.5">
                      {course.materials.map((m, i) => (
                        <li key={i} className="flex items-center gap-2">
                          <input
                            value={m}
                            onChange={(e) => updateMaterial(i, e.target.value)}
                            className="flex-1 rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground"
                          />
                          <button
                            type="button"
                            onClick={() => removeMaterial(i)}
                            className="rounded-md px-1.5 py-1 text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          >
                            ✕
                          </button>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                <section className="space-y-2">
                  <h3 className="text-sm font-semibold text-foreground">
                    Schedule items ({items.filter((i) => i.include).length} of {items.length}{' '}
                    selected)
                  </h3>
                  {items.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      No dated items found in this syllabus.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {items.map((it) => (
                        <div
                          key={it.key}
                          className={cn(
                            'rounded-lg border p-2.5 text-xs',
                            it.include ? 'border-border' : 'border-dashed border-border opacity-70',
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={it.include}
                              disabled={!it.dueDate}
                              onChange={(e) => updateItem(it.key, { include: e.target.checked })}
                              className="h-3.5 w-3.5 rounded border-border accent-primary"
                            />
                            <input
                              value={it.title}
                              onChange={(e) => updateItem(it.key, { title: e.target.value })}
                              className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1 font-medium text-foreground"
                            />
                            <select
                              value={it.type}
                              onChange={(e) =>
                                updateItem(it.key, { type: e.target.value as AssignmentType })
                              }
                              className="rounded-md border border-border bg-background px-1.5 py-1 text-foreground"
                            >
                              {Object.entries(TYPE_LABELS).map(([value, label]) => (
                                <option key={value} value={value}>
                                  {label}
                                </option>
                              ))}
                            </select>
                            <input
                              type="date"
                              value={it.dueDate ?? ''}
                              onChange={(e) =>
                                updateItem(it.key, {
                                  dueDate: e.target.value || null,
                                  include: e.target.value ? it.include : false,
                                })
                              }
                              className="rounded-md border border-border bg-background px-1.5 py-1 text-foreground"
                            />
                          </div>
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 pl-6">
                            {it.dateConfidence === 'approximate' && (
                              <span className="rounded-full bg-load-medium/10 px-2 py-0.5 font-semibold text-load-medium">
                                ~ approximate date, please confirm
                              </span>
                            )}
                            {it.dateConfidence === 'unknown' && (
                              <span className="rounded-full bg-accent px-2 py-0.5 font-medium text-muted-foreground">
                                No date found - add one to include this
                              </span>
                            )}
                            {it.highStakes && (
                              <span className="rounded-full bg-load-critical/10 px-2 py-0.5 font-semibold text-load-critical">
                                High stakes
                              </span>
                            )}
                            {it.gradeWeight != null && (
                              <span className="rounded-full bg-primary/10 px-2 py-0.5 font-semibold text-primary">
                                {it.gradeWeight}% of grade
                              </span>
                            )}
                            {it.notes && <span className="text-muted-foreground">{it.notes}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                {unresolved.length > 0 && (
                  <section className="rounded-lg border border-load-medium/30 bg-load-medium/10 p-3">
                    <h3 className="text-xs font-semibold text-load-medium">
                      Couldn&apos;t determine
                    </h3>
                    <ul className="mt-1.5 space-y-1 text-xs text-foreground">
                      {unresolved.map((note, i) => (
                        <li key={i}>• {note}</li>
                      ))}
                    </ul>
                  </section>
                )}
              </div>
            )}
          </CardContent>

          {(step === 'review' || step === 'saving') && (
            <CardFooter className="justify-end gap-2">
              <button
                type="button"
                onClick={handleClose}
                className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-accent transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={step === 'saving' || !course?.code || !course?.title}
                className="rounded-lg bg-primary text-primary-foreground text-sm font-semibold px-4 py-2 transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {step === 'saving' ? 'Saving...' : 'Add Course & Tasks'}
              </button>
            </CardFooter>
          )}
        </Card>
      </div>
    </div>
  );
}

/** Wraps the existing resumable-upload hook for a one-shot call outside of
 * its own component lifecycle, so the originally-uploaded PDF ends up
 * attached to the new course exactly like a manual syllabus upload would -
 * reusing tested code instead of a second upload path. */
async function saveSyllabusPdf(userId: string, courseId: string, file: File) {
  const { ref, uploadBytes, getDownloadURL } = await import('firebase/storage');
  const { doc, setDoc } = await import('firebase/firestore');
  const { storage, db } = await import('@/lib/firebase/client');
  if (!storage || !db) throw new Error('Storage is not configured.');

  const id = crypto.randomUUID();
  const storagePath = `users/${userId}/syllabi/${courseId}/${id}-${file.name}`;
  const snapshot = await uploadBytes(ref(storage, storagePath), file);
  const downloadURL = await getDownloadURL(snapshot.ref);
  await setDoc(doc(db, 'users', userId, 'courses', courseId, 'syllabi', id), {
    id,
    courseId,
    fileName: file.name,
    storagePath,
    downloadURL,
    sizeBytes: file.size,
    uploadedAt: new Date().toISOString(),
  });
}

function TextField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-foreground">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
      />
    </div>
  );
}
