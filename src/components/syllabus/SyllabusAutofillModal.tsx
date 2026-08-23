'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardFooter } from '@/components/ui/Card';
import { validateSyllabusFile } from '@/lib/validation/syllabusFile';
import { createCourseWithScheduleItems } from '@/lib/firestore/courses';
import { courseFormSchema } from '@/lib/validation/course';
import { scheduleItemFormSchema } from '@/lib/validation/scheduleItem';
import { useModalA11y } from '@/hooks/useModalA11y';
import { useAppState } from '@/context/AppStateContext';
import { useAuth } from '@/context/AuthContext';
import { COURSE_COLOR_PRESETS, courseSwatch, pickSuggestedCourseColor } from '@/lib/courseColors';
import { COURSE_ICON_PRESETS, pickSuggestedCourseIcon } from '@/lib/courseIcons';
import { CourseIconGlyph } from '@/components/ui/CourseIconGlyph';
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

const STEPS: { key: Step; label: string }[] = [
  { key: 'upload', label: 'Upload' },
  { key: 'extracting', label: 'Parse' },
  { key: 'review', label: 'Review' },
  { key: 'saving', label: 'Save' },
];

interface DraftItem extends ExtractedScheduleItem {
  /** Local id for React keys/editing - not persisted as-is. */
  key: string;
  /** Whether this item will be created when the user confirms. Items with
   * no resolvable date start rejected and locked until a date is filled
   * in, so nothing with a fabricated date silently lands on the calendar. */
  approved: boolean;
}

/** Classifies a caught extraction error into a user-facing bucket so the UI
 * never surfaces a raw fetch/JS error message (e.g. the literal string
 * "Failed to fetch") to the student. `fetch()` itself rejects with a
 * TypeError on a genuine network failure (offline, DNS, CORS, connection
 * reset) across browsers - that's the one case we can reliably tell apart
 * from a server-returned/parse failure, which covers everything else. */
function classifyExtractionError(err: unknown): 'network' | 'auth' | 'parsing' {
  if (err instanceof Error && err.message === 'You must be signed in.') return 'auth';
  if (err instanceof TypeError) return 'network';
  return 'parsing';
}

const EXTRACTION_ERROR_COPY: Record<ReturnType<typeof classifyExtractionError>, string> = {
  network: "Couldn't reach the server — check your connection and try again.",
  auth: 'You must be signed in to use Syllabus Autofill.',
  parsing: "Couldn't read that file — try a different PDF or Word doc.",
};

/** Strips the synthetic per-item `key` (React list identity only, never
 * part of the extracted data) before a draft is snapshotted/compared for
 * the SY-5 dirty check. */
function omitDraftKey(item: DraftItem): Omit<DraftItem, 'key'> {
  const rest: Partial<DraftItem> = { ...item };
  delete rest.key;
  return rest as Omit<DraftItem, 'key'>;
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
  const [rerunCount, setRerunCount] = useState(0);
  const [showRerunConfirm, setShowRerunConfirm] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  /** Snapshot (as a JSON string, for a cheap deep-equality check) of the
   * draft exactly as Claude returned it, taken right after the most recent
   * successful extraction. Compared against the live draft before a rerun
   * so a student who has already hand-corrected titles/dates/approvals
   * gets a confirmation instead of losing that work silently (SY-5). */
  const initialDraftRef = useRef<string | null>(null);

  const [course, setCourse] = useState<{
    code: string;
    title: string;
    instructor: string;
    term: string;
    color: string;
    icon: string;
    modality: CourseModality | undefined;
    meetingTimes: MeetingTime[];
    materials: string[];
    skipDates: string[];
    notes: string;
  } | null>(null);
  const [items, setItems] = useState<DraftItem[]>([]);
  const [unresolved, setUnresolved] = useState<string[]>([]);
  /** Claude's suggested syllabus file name, freely editable - not just a
   * caption. Empty string is valid input mid-edit; falls back to the
   * original upload's name at save time if left blank. */
  const [fileName, setFileName] = useState('');

  const reset = () => {
    setStep('upload');
    setFile(null);
    setError(null);
    setCourse(null);
    setItems([]);
    setUnresolved([]);
    setFileName('');
    setRerunCount(0);
    setShowRerunConfirm(false);
    initialDraftRef.current = null;
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

  const runExtraction = async (selected: File) => {
    setError(null);
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
      const nextCourse = {
        code: result.course.code,
        title: result.course.title,
        instructor: result.course.instructor ?? '',
        term: result.course.term ?? '',
        // Claude's subject-matched suggestion when it made one and it isn't
        // already taken by another of this term's courses; otherwise falls
        // back to whichever preset is least represented so extracted
        // courses don't all default to the same blue. Either way, the user
        // can still change it on the review screen before confirming.
        color: pickSuggestedCourseColor(
          state.courses,
          result.course.term,
          result.course.suggestedColor,
        ),
        icon: pickSuggestedCourseIcon(
          state.courses,
          result.course.term,
          result.course.suggestedIcon,
        ),
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
      };
      const nextItems: DraftItem[] = result.scheduleItems.map((item, i) => ({
        ...item,
        key: `${i}-${item.title}`,
        approved: item.dueDate !== null,
      }));
      const nextUnresolved = result.unresolved;

      setCourse(nextCourse);
      setItems(nextItems);
      setUnresolved(nextUnresolved);
      setFileName(
        dedupeSuggestedFileName(
          state.courses,
          result.course.term,
          result.course.code,
          result.course.suggestedFileName,
        ),
      );
      // Baseline for the SY-5 "did the student already edit this?" check -
      // taken from the exact objects just written to state, minus the
      // synthetic per-item `key` used only for React list identity.
      initialDraftRef.current = JSON.stringify({
        course: nextCourse,
        items: nextItems.map(omitDraftKey),
        unresolved: nextUnresolved,
      });
      setStep('review');
    } catch (err) {
      // Never surface the raw fetch/JS error (e.g. "Failed to fetch") to
      // the student - map it to typed, actionable copy instead (SY-1).
      setError(EXTRACTION_ERROR_COPY[classifyExtractionError(err)]);
      setStep(course ? 'review' : 'upload');
    }
  };

  const handleFile = async (selected: File) => {
    const result = validateSyllabusFile(selected);
    if (!result.valid) {
      setError(result.error ?? 'Invalid file.');
      return;
    }
    setFile(selected);
    await runExtraction(selected);
  };

  /** True once the live draft has diverged from the extraction it started
   * from - a hand-edited title/date/approval, a rejected item, an added
   * material, etc. Deliberately a simple stringified-snapshot comparison
   * (SY-5 only asks for "simple," not sophisticated) rather than a field-
   * by-field diff. */
  const isDraftDirty = () => {
    if (!initialDraftRef.current) return false;
    const current = JSON.stringify({
      course,
      items: items.map(omitDraftKey),
      unresolved,
    });
    return current !== initialDraftRef.current;
  };

  /** "Reject and send it back to the AI": discards the current draft and
   * re-runs extraction on the same uploaded file. A fresh pass can land
   * differently since the model isn't deterministic, and it's cheaper than
   * asking the student to re-upload. Guarded behind a confirmation when the
   * student has already hand-corrected the draft, so one click can't
   * silently erase several minutes of careful review (SY-5). */
  const handleRerun = async () => {
    if (!file) return;
    if (isDraftDirty()) {
      setShowRerunConfirm(true);
      return;
    }
    setRerunCount((n) => n + 1);
    await runExtraction(file);
  };

  const confirmRerun = async () => {
    setShowRerunConfirm(false);
    if (!file) return;
    setRerunCount((n) => n + 1);
    await runExtraction(file);
  };

  /** Clears the failed pick and reopens the file browser, for the "Choose a
   * different file" affordance on the post-failure error view (SY-1). */
  const chooseDifferentFile = () => {
    setError(null);
    setFile(null);
    inputRef.current?.click();
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

  const approveAll = () => {
    setItems((prev) => prev.map((it) => ({ ...it, approved: it.dueDate !== null })));
  };

  const rejectAll = () => {
    setItems((prev) => prev.map((it) => ({ ...it, approved: false })));
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

  const approvedCount = items.filter((i) => i.approved).length;
  // Counts for the VA-3 post-extraction summary chip: high-stakes uses the
  // same `highStakes` flag the per-item badge already renders below, and
  // "needs confirmation" uses the same dateConfidence values the per-item
  // badges already flag ("approximate" / "unknown") - no new concept, just
  // surfacing what the review list already tracks per item as a headline.
  const highStakesCount = items.filter((i) => i.highStakes).length;
  const needsConfirmationCount = items.filter((i) => i.dateConfidence !== 'exact').length;

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
      if (!it.approved || !it.dueDate) continue;
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
        icon: course.icon,
        source: 'ai',
        ...(course.instructor ? { instructor: course.instructor } : {}),
        ...(course.term ? { term: course.term } : {}),
        ...(course.modality ? { modality: course.modality } : {}),
        ...(course.meetingTimes.length ? { meetingTimes: course.meetingTimes } : {}),
        ...(course.materials.length ? { materials: course.materials.filter(Boolean) } : {}),
        ...(course.skipDates.length ? { skipDates: course.skipDates } : {}),
        ...(course.notes ? { notes: course.notes } : {}),
      };
      const approved = items.filter((it) => it.approved && it.dueDate);
      const scheduleItems: ScheduleItem[] = approved.map((it) => ({
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
          await saveSyllabusPdf(user.uid, newCourse.id, withFileName(file, fileName));
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
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4 py-8 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="autofill-title"
      onClick={step === 'upload' ? handleClose : undefined}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="max-h-full w-full max-w-3xl overflow-y-auto outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <Card className="overflow-hidden rounded-3xl border-none p-0 shadow-modal">
          <div className="bg-gradient-brand px-6 py-6 text-white sm:px-8">
            <p className="text-xs font-semibold uppercase tracking-wide text-white/70">
              Syllabus Autofill
            </p>
            <h2 id="autofill-title" className="mt-1 text-xl font-bold tracking-tight sm:text-2xl">
              Let Claude read it, you decide what sticks
            </h2>
            <p className="mt-1.5 max-w-xl text-sm text-white/80">
              Grade weights, high-stakes deadlines, and easy-to-miss dates get buried in a long
              PDF &mdash; Claude pulls them out so nothing slips by, and you approve every one
              before it hits your calendar.
            </p>
            <div className="mt-5">
              <StepIndicator step={step} />
            </div>
          </div>

          <CardContent className="space-y-5 p-6 sm:p-8">
            {/* The post-failure retry view below (SY-1) already shows this
                same message inline with the retained file, so the generic
                banner is suppressed there to avoid saying it twice. */}
            {error && !(step === 'upload' && file) && (
              <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-sm text-destructive">
                <svg
                  className="mt-0.5 h-4 w-4 shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
                <span>{error}</span>
              </div>
            )}

            {step === 'upload' && file && error ? (
              // SY-1: a failed extraction lands back here, but with the
              // originally-picked file retained and named - never the bare
              // "drop a file" prompt again, which read as if nothing had
              // been chosen at all.
              <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-destructive/30 bg-destructive/5 px-4 py-16 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
                  <svg
                    className="h-6 w-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.75}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                </span>
                <span className="max-w-xs truncate text-sm font-semibold text-foreground">
                  {file.name}
                </span>
                <span className="text-xs text-destructive">{error}</span>
                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => runExtraction(file)}
                    className="rounded-lg bg-primary text-primary-foreground text-sm font-semibold px-4 py-2 transition-opacity hover:opacity-90"
                  >
                    Try again
                  </button>
                  <button
                    type="button"
                    onClick={chooseDifferentFile}
                    className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
                  >
                    Choose a different file
                  </button>
                </div>
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
            ) : (
              step === 'upload' && (
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
                    'flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-16 text-center cursor-pointer transition-colors',
                    dragActive
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:bg-accent/60',
                  )}
                >
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <svg
                      className="h-6 w-6"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.75}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M12 12v9m0-9l-3 3m3-3l3 3"
                      />
                    </svg>
                  </span>
                  {/* MO-5: dragging onto a browser tab isn't possible on a
                      touch device, so the universally-applicable tap action
                      leads, with drag demoted to secondary desktop-only copy. */}
                  <span className="text-sm font-semibold text-foreground">
                    Tap to choose a file
                  </span>
                  <span className="text-xs text-muted-foreground">
                    or drag a syllabus PDF or Word doc here
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
              )
            )}

            {step === 'extracting' && (
              <div className="flex flex-col items-center justify-center gap-4 py-16">
                <div className="relative h-12 w-12">
                  <div className="spinner-gradient absolute inset-0 animate-spin rounded-full" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-foreground">
                    {rerunCount > 0 ? 'Giving it another pass...' : 'Reading your syllabus...'}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Pulling out grade weights, high-stakes items, and registrar deadlines &mdash;
                    not just a list of assignments.
                  </p>
                </div>
              </div>
            )}

            {(step === 'review' || step === 'saving') && course && (
              <div className="space-y-6">
                {/* VA-3: names what was actually protected against, right
                    where the student lands after extraction completes. */}
                {items.length > 0 && (
                  <div
                    className="review-reveal flex flex-wrap items-center gap-1.5 text-xs font-semibold"
                    style={{ animationDelay: '0ms' }}
                  >
                    <span className="rounded-full bg-primary/10 px-2.5 py-1 text-primary">
                      Found {items.length} item{items.length === 1 ? '' : 's'}
                    </span>
                    {highStakesCount > 0 && (
                      <span className="rounded-full bg-load-critical/10 px-2.5 py-1 text-load-critical">
                        {highStakesCount} high-stakes
                      </span>
                    )}
                    {needsConfirmationCount > 0 && (
                      <span className="rounded-full bg-load-medium/10 px-2.5 py-1 text-load-medium">
                        {needsConfirmationCount} date{needsConfirmationCount === 1 ? '' : 's'}{' '}
                        {needsConfirmationCount === 1 ? 'needs' : 'need'} confirmation
                      </span>
                    )}
                  </div>
                )}
                <section
                  className="review-reveal space-y-4 rounded-2xl border border-border bg-accent/30 p-4 sm:p-5"
                  style={{ animationDelay: '0ms' }}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={cn(
                        'flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm',
                        courseSwatch(course.color).className,
                      )}
                      style={courseSwatch(course.color).style}
                    >
                      <CourseIconGlyph icon={course.icon} className="h-6 w-6" />
                    </span>
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="grid grid-cols-2 gap-2.5">
                        <TextField
                          id="autofill-course-code"
                          label="Code"
                          value={course.code}
                          onChange={(v) => setCourse((c) => c && { ...c, code: v })}
                        />
                        <TextField
                          id="autofill-course-term"
                          label="Term"
                          value={course.term}
                          onChange={(v) => setCourse((c) => c && { ...c, term: v })}
                        />
                      </div>
                      <TextField
                        id="autofill-course-title"
                        label="Title"
                        value={course.title}
                        onChange={(v) => setCourse((c) => c && { ...c, title: v })}
                      />
                    </div>
                  </div>

                  <TextField
                    id="autofill-course-instructor"
                    label="Instructor"
                    value={course.instructor}
                    onChange={(v) => setCourse((c) => c && { ...c, instructor: v })}
                  />

                  <div className="space-y-1.5">
                    <span className="text-xs font-semibold text-muted-foreground">Color</span>
                    <div className="flex flex-wrap gap-2">
                      {COURSE_COLOR_PRESETS.map((preset) => (
                        <button
                          key={preset.value}
                          type="button"
                          aria-label={preset.value}
                          onClick={() => setCourse((c) => c && { ...c, color: preset.value })}
                          className={cn(
                            'h-7 w-7 rounded-full transition-transform',
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
                          'relative flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full border border-dashed border-border text-muted-foreground transition-transform hover:scale-110',
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
                          value={course.color.startsWith('#') ? course.color : '#7c3aed'}
                          onChange={(e) => setCourse((c) => c && { ...c, color: e.target.value })}
                        />
                      </label>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <span className="text-xs font-semibold text-muted-foreground">Icon</span>
                    <div className="flex flex-wrap gap-2">
                      {COURSE_ICON_PRESETS.map((preset) => (
                        <button
                          key={preset.value}
                          type="button"
                          title={preset.label}
                          aria-label={preset.label}
                          onClick={() => setCourse((c) => c && { ...c, icon: preset.value })}
                          className={cn(
                            'flex h-8 w-8 items-center justify-center rounded-full border text-muted-foreground transition-colors',
                            course.icon === preset.value
                              ? 'border-primary bg-primary/10 text-primary'
                              : 'border-border bg-card hover:bg-accent',
                          )}
                        >
                          <CourseIconGlyph icon={preset.value} className="h-4 w-4" />
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="autofill-filename"
                      className="text-xs font-semibold text-muted-foreground"
                    >
                      Syllabus file name
                    </label>
                    <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
                      <svg
                        className="h-4 w-4 shrink-0 text-muted-foreground"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={1.75}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                      <input
                        id="autofill-filename"
                        value={fileName}
                        onChange={(e) => setFileName(e.target.value)}
                        placeholder={file?.name ?? 'Syllabus'}
                        className="min-w-0 flex-1 bg-transparent text-sm text-foreground focus:outline-none"
                      />
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {extensionOf(file?.name)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Color, icon, and this file name are Claude&apos;s suggestions &mdash; every
                      one is editable.
                    </p>
                  </div>
                </section>

                {course.meetingTimes.length > 0 && (
                  <section className="review-reveal space-y-2" style={{ animationDelay: '60ms' }}>
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
                  <section className="review-reveal space-y-2" style={{ animationDelay: '120ms' }}>
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

                {/* SY-3: course.notes and course.skipDates were parsed and
                    saved to Firestore on confirm but never shown anywhere in
                    this review UI - a lost "it actually read this" moment.
                    Read-only per the finding's minimum bar, with notes as a
                    light editable bonus since it reuses the existing
                    TextField-style pattern already used above. */}
                {(course.notes || course.skipDates.length > 0) && (
                  <section
                    className="review-reveal space-y-2.5 rounded-xl border border-primary/20 bg-primary/5 p-3 sm:p-4"
                    style={{ animationDelay: '150ms' }}
                  >
                    <h3 className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                      <svg
                        className="h-3.5 w-3.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
                        />
                      </svg>
                      Claude also caught
                    </h3>
                    {course.notes && (
                      <div className="space-y-1">
                        <label
                          htmlFor="autofill-course-notes"
                          className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
                        >
                          Fine print
                        </label>
                        <textarea
                          id="autofill-course-notes"
                          value={course.notes}
                          onChange={(e) => setCourse((c) => c && { ...c, notes: e.target.value })}
                          rows={2}
                          className="w-full resize-none rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                      </div>
                    )}
                    {course.skipDates.length > 0 && (
                      <div className="space-y-1">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          No class on
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {course.skipDates.map((d) => (
                            <span
                              key={d}
                              className="rounded-full border border-primary/30 bg-card px-2 py-0.5 text-xs font-medium text-foreground"
                            >
                              {formatIsoDate(d)}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </section>
                )}

                <section className="space-y-3">
                  <div
                    className="review-reveal flex flex-wrap items-center justify-between gap-2"
                    style={{ animationDelay: '180ms' }}
                  >
                    <h3 className="text-sm font-semibold text-foreground">
                      What Claude found
                      <span className="ml-1.5 font-normal text-muted-foreground">
                        {approvedCount} of {items.length} approved
                      </span>
                    </h3>
                    {items.length > 0 && (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={approveAll}
                          className="rounded-full border border-border px-2.5 py-1 text-xs font-semibold text-foreground transition-colors hover:bg-accent"
                        >
                          Approve all
                        </button>
                        <button
                          type="button"
                          onClick={rejectAll}
                          className="rounded-full border border-border px-2.5 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:bg-accent"
                        >
                          Reject all
                        </button>
                        {file && (
                          <button
                            type="button"
                            onClick={handleRerun}
                            className="ml-1 flex items-center gap-1 rounded-full border border-dashed border-primary/40 px-2.5 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary/10"
                            title="Not right? Discard this draft and ask Claude to re-read the file."
                          >
                            <svg
                              className="h-3 w-3"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2.25}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                              />
                            </svg>
                            Not right? Re-run AI
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  {items.length === 0 ? (
                    <p
                      className="review-reveal text-xs text-muted-foreground"
                      style={{ animationDelay: '220ms' }}
                    >
                      No dated items found in this syllabus.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {items.map((it, i) => (
                        <div
                          key={it.key}
                          className={cn(
                            'review-reveal rounded-xl border p-3 text-xs transition-colors',
                            it.approved
                              ? 'border-border bg-card'
                              : 'border-dashed border-border/70 bg-transparent opacity-60',
                          )}
                          style={{ animationDelay: `${Math.min(220 + i * 40, 580)}ms` }}
                        >
                          {/* SY-2: below `sm` this becomes two stacked rows -
                              the title gets its own full-width line instead
                              of losing the space race to the toggle/type/
                              date controls in one unwrapping row. At `sm`
                              and up, the inner wrapper collapses via
                              `sm:contents` so its children rejoin the outer
                              flex row and the original single-row desktop
                              layout (and order) is unchanged. */}
                          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                            <input
                              value={it.title}
                              onChange={(e) => updateItem(it.key, { title: e.target.value })}
                              className="w-full min-w-0 rounded-md border border-border bg-background px-2 py-1 font-medium text-foreground sm:order-2 sm:flex-1"
                            />
                            <div className="flex flex-wrap items-center gap-2 sm:contents">
                              <div className="flex shrink-0 overflow-hidden rounded-full border border-border sm:order-1">
                                <button
                                  type="button"
                                  onClick={() => updateItem(it.key, { approved: true })}
                                  disabled={!it.dueDate}
                                  className={cn(
                                    'px-2.5 py-1 font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40',
                                    it.approved
                                      ? 'bg-primary text-primary-foreground'
                                      : 'bg-card text-muted-foreground hover:bg-accent',
                                  )}
                                >
                                  Approve
                                </button>
                                <button
                                  type="button"
                                  onClick={() => updateItem(it.key, { approved: false })}
                                  className={cn(
                                    'border-l border-border px-2.5 py-1 font-semibold transition-colors',
                                    !it.approved
                                      ? 'bg-destructive/10 text-destructive'
                                      : 'bg-card text-muted-foreground hover:bg-accent',
                                  )}
                                >
                                  Reject
                                </button>
                              </div>
                              <select
                                value={it.type}
                                onChange={(e) =>
                                  updateItem(it.key, { type: e.target.value as AssignmentType })
                                }
                                className="rounded-md border border-border bg-background px-1.5 py-1 text-foreground sm:order-3"
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
                                    approved: e.target.value ? it.approved : false,
                                  })
                                }
                                className="rounded-md border border-border bg-background px-1.5 py-1 text-foreground sm:order-4"
                              />
                            </div>
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-1.5 sm:pl-[4.5rem]">
                            {/* SY-4c: non-assignment calendar items (registrar
                                deadlines, mandatory dates, etc.) render inside
                                this same list - a small distinct badge keeps
                                them from reading as just another assignment. */}
                            {it.type === 'other' && (
                              <span className="rounded-full border border-border bg-accent px-2 py-0.5 font-semibold text-foreground">
                                Key date
                              </span>
                            )}
                            {it.dateConfidence === 'approximate' && (
                              <span className="rounded-full bg-load-medium/10 px-2 py-0.5 font-semibold text-load-medium">
                                ~ approximate date, please confirm
                              </span>
                            )}
                            {it.dateConfidence === 'unknown' && (
                              <span className="rounded-full bg-accent px-2 py-0.5 font-medium text-muted-foreground">
                                No date found - add one to approve this
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
                  <section
                    className="review-reveal rounded-xl border border-load-medium/30 bg-load-medium/10 p-3"
                    style={{ animationDelay: '580ms' }}
                  >
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
            <CardFooter className="flex-wrap justify-end gap-2 border-t border-border bg-accent/20 px-6 py-4 sm:px-8">
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
                {step === 'saving'
                  ? 'Saving...'
                  : `Add Course & ${approvedCount} Task${approvedCount === 1 ? '' : 's'}`}
              </button>
            </CardFooter>
          )}
        </Card>
      </div>

      {/* SY-5: rerun would otherwise silently overwrite hand-corrected
          titles/dates/approvals with zero confirmation - this only appears
          when handleRerun's dirty check found a real difference from the
          original extraction. */}
      {showRerunConfirm && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 px-4"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="rerun-confirm-title"
        >
          <div className="w-full max-w-sm rounded-2xl bg-card p-5 shadow-modal">
            <h3 id="rerun-confirm-title" className="text-sm font-semibold text-foreground">
              Discard your edits?
            </h3>
            <p className="mt-1.5 text-xs text-muted-foreground">
              Re-running will discard your edits &mdash; continue?
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowRerunConfirm(false)}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmRerun}
                className="rounded-lg bg-destructive text-destructive-foreground text-xs font-semibold px-3 py-1.5 transition-opacity hover:opacity-90"
              >
                Discard &amp; re-run
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StepIndicator({ step }: { step: Step }) {
  const currentIndex = STEPS.findIndex((s) => s.key === step);
  return (
    <ol className="flex items-center gap-2">
      {STEPS.map((s, i) => (
        <li key={s.key} className="flex flex-1 items-center gap-2 last:flex-none">
          <div className="flex shrink-0 items-center gap-1.5">
            <span
              className={cn(
                'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold transition-colors',
                i < currentIndex
                  ? 'bg-white text-primary'
                  : i === currentIndex
                    ? 'bg-white/25 text-white ring-2 ring-white'
                    : 'bg-white/15 text-white/60',
              )}
            >
              {i < currentIndex ? (
                <svg
                  className="h-3 w-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={3}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                i + 1
              )}
            </span>
            <span
              className={cn(
                'text-xs font-semibold whitespace-nowrap',
                i <= currentIndex ? 'text-white' : 'text-white/50',
              )}
            >
              {s.label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div className={cn('h-px flex-1', i < currentIndex ? 'bg-white/70' : 'bg-white/20')} />
          )}
        </li>
      ))}
    </ol>
  );
}

/** Suffixes Claude's suggested file name with a small disambiguator when
 * another course this term already shares this course's code (e.g. two
 * sections of the same class) - not a guarantee against every possible
 * collision, just enough that the common case doesn't quietly produce two
 * identically-named syllabus files. The user can still edit it either way. */
function dedupeSuggestedFileName(
  existingCourses: Pick<Course, 'code' | 'term'>[],
  term: string | null | undefined,
  code: string | undefined,
  suggested: string | null | undefined,
): string {
  if (!suggested || !code) return suggested ?? '';
  const collisions = existingCourses.filter((c) => c.term === term && c.code === code).length;
  return collisions > 0 ? `${suggested} (${collisions + 1})` : suggested;
}

/** Formats an ISO YYYY-MM-DD skipDate as a short human date (e.g. "Mar 9,
 * 2026") for the SY-3 "Claude also caught" callout, without pulling in a
 * date library for one label. Parsed as UTC noon rather than midnight so a
 * negative-offset timezone can't roll the displayed date back a day. */
function formatIsoDate(iso: string): string {
  const parsed = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function extensionOf(name: string | undefined): string {
  if (!name) return '';
  const dotIndex = name.lastIndexOf('.');
  return dotIndex > -1 ? name.slice(dotIndex) : '';
}

/** Renames a File to the (editable) suggested display name, keeping the
 * original extension, so the syllabus shows up in the course's file list
 * as e.g. "ECON 201 - Fall 2026 Syllabus.pdf" instead of whatever the
 * source file happened to be called. Falls back to the original file
 * untouched when the field was left blank. */
function withFileName(file: File, name: string): File {
  const trimmed = name.trim();
  if (!trimmed) return file;
  return new File([file], `${trimmed}${extensionOf(file.name)}`, { type: file.type });
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
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-xs font-semibold text-muted-foreground">
        {label}
      </label>
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
      />
    </div>
  );
}
