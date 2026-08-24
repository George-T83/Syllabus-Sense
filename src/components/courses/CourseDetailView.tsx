'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BackLink } from '@/components/ui/BackLink';
import { Card } from '@/components/ui/Card';
import { CardActionButton } from '@/components/ui/CardAction';
import { EmptyState } from '@/components/ui/EmptyState';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { TaskRow } from '@/components/ui/TaskRow';
import { useAppState } from '@/context/AppStateContext';
import { useAuth } from '@/context/AuthContext';
import { updateCourse, deleteCourse } from '@/lib/firestore/courses';
import {
  createScheduleItem,
  updateScheduleItem,
  deleteScheduleItem,
} from '@/lib/firestore/scheduleItems';
import { createContact, updateContact } from '@/lib/firestore/contacts';
import { CourseFormModal } from '@/components/courses/CourseFormModal';
import { TaskFormModal } from '@/components/tasks/TaskFormModal';
import { SyllabusUploader } from '@/components/syllabus/SyllabusUploader';
import { SyllabusList } from '@/components/syllabus/SyllabusList';
import { CourseAiSummaryCard } from '@/components/courses/CourseAiSummaryCard';
import { formatTimeLabel } from '@/lib/calendar/meetings';
import { buildICSFilename, createICSBlob, generateICS } from '@/lib/export/ics';
import { generateRateMyProfessorUrl } from '@/lib/export/rateMyProfessor';
import { courseSwatch } from '@/lib/courseColors';
import { cn } from '@/lib/utils';
import type { CourseFormValues } from '@/lib/validation/course';
import type { ScheduleItemFormValues } from '@/lib/validation/scheduleItem';
import type { ScheduleItem, Contact, ContactRole } from '@/types/schedule';

const dueDateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
const WEEKDAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Below this many logged tasks, `progressPct` is too small a sample to read
 * as a meaningful measure of how the class is going - a single seeded task
 * marked done would otherwise render a triumphant full ring (CO-3). Below
 * the threshold a muted outline stands in for the gradient ring. */
const RING_MIN_TASK_COUNT = 3;

/**
 * Lightweight `**bold**` → `<strong>` pass for learning objectives (which may
 * carry markdown emphasis straight from the AI extractor, e.g. "**Analyze**
 * primary sources for bias"). Deliberately not a markdown library - this is
 * the only markdown syntax objectives ever contain.
 */
function renderInlineBold(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? (
      <strong key={i}>{part.slice(2, -2)}</strong>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

const inputClass =
  'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary';

interface ContactFormState {
  fullName: string;
  role: ContactRole;
  title: string;
  howToAddress: string;
  email: string;
  officeHours: string;
  officeLocation: string;
}

const EMPTY_CONTACT_FORM: ContactFormState = {
  fullName: '',
  role: 'professor',
  title: '',
  howToAddress: '',
  email: '',
  officeHours: '',
  officeLocation: '',
};

/** Shared field set for both the "add contact" and "edit contact" inline
 * forms, so the two stay visually and behaviorally identical. */
function ContactFormFields({
  value,
  onChange,
  idPrefix,
}: {
  value: ContactFormState;
  onChange: (next: ContactFormState) => void;
  idPrefix: string;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="col-span-2 space-y-1.5 sm:col-span-1">
        <label htmlFor={`${idPrefix}-fullName`} className="text-xs font-medium text-foreground">
          Full name
        </label>
        <input
          id={`${idPrefix}-fullName`}
          value={value.fullName}
          onChange={(e) => onChange({ ...value, fullName: e.target.value })}
          className={inputClass}
          placeholder="Dr. Jane Chen"
        />
      </div>
      <div className="col-span-2 space-y-1.5 sm:col-span-1">
        <label htmlFor={`${idPrefix}-role`} className="text-xs font-medium text-foreground">
          Role
        </label>
        <select
          id={`${idPrefix}-role`}
          value={value.role}
          onChange={(e) => onChange({ ...value, role: e.target.value as ContactRole })}
          className={inputClass}
        >
          <option value="professor">Professor</option>
          <option value="ta">TA</option>
        </select>
      </div>
      <div className="col-span-2 space-y-1.5 sm:col-span-1">
        <label htmlFor={`${idPrefix}-title`} className="text-xs font-medium text-foreground">
          Title
        </label>
        <input
          id={`${idPrefix}-title`}
          value={value.title}
          onChange={(e) => onChange({ ...value, title: e.target.value })}
          className={inputClass}
          placeholder="Associate Professor"
        />
      </div>
      <div className="col-span-2 space-y-1.5 sm:col-span-1">
        <label htmlFor={`${idPrefix}-howToAddress`} className="text-xs font-medium text-foreground">
          Address as
        </label>
        <input
          id={`${idPrefix}-howToAddress`}
          value={value.howToAddress}
          onChange={(e) => onChange({ ...value, howToAddress: e.target.value })}
          className={inputClass}
          placeholder="Dr. Chen"
        />
      </div>
      <div className="col-span-2 space-y-1.5 sm:col-span-1">
        <label htmlFor={`${idPrefix}-email`} className="text-xs font-medium text-foreground">
          Email
        </label>
        <input
          id={`${idPrefix}-email`}
          type="email"
          value={value.email}
          onChange={(e) => onChange({ ...value, email: e.target.value })}
          className={inputClass}
          placeholder="jchen@university.edu"
        />
      </div>
      <div className="col-span-2 space-y-1.5 sm:col-span-1">
        <label htmlFor={`${idPrefix}-officeHours`} className="text-xs font-medium text-foreground">
          Office hours
        </label>
        <input
          id={`${idPrefix}-officeHours`}
          value={value.officeHours}
          onChange={(e) => onChange({ ...value, officeHours: e.target.value })}
          className={inputClass}
          placeholder="Tue/Thu 2-3pm"
        />
      </div>
      <div className="col-span-2 space-y-1.5">
        <label
          htmlFor={`${idPrefix}-officeLocation`}
          className="text-xs font-medium text-foreground"
        >
          Office location
        </label>
        <input
          id={`${idPrefix}-officeLocation`}
          value={value.officeLocation}
          onChange={(e) => onChange({ ...value, officeLocation: e.target.value })}
          className={inputClass}
          placeholder="Room 204, Science Hall"
        />
      </div>
    </div>
  );
}

export function CourseDetailView({ courseId }: { courseId: string }) {
  const { state, dispatch } = useAppState();
  const { user } = useAuth();
  const router = useRouter();

  const [editCourseOpen, setEditCourseOpen] = useState(false);
  const [addTaskOpen, setAddTaskOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ScheduleItem | null>(null);
  const [confirmingDeleteCourse, setConfirmingDeleteCourse] = useState(false);
  const [confirmingDeleteItemId, setConfirmingDeleteItemId] = useState<string | null>(null);

  const [addContactOpen, setAddContactOpen] = useState(false);
  const [newContact, setNewContact] = useState<ContactFormState>(EMPTY_CONTACT_FORM);
  const [savingContact, setSavingContact] = useState(false);
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [editContact, setEditContact] = useState<ContactFormState>(EMPTY_CONTACT_FORM);

  const [editingObjectiveIndex, setEditingObjectiveIndex] = useState<number | null>(null);
  const [objectiveDraft, setObjectiveDraft] = useState('');
  const [addingObjective, setAddingObjective] = useState(false);
  const [newObjectiveDraft, setNewObjectiveDraft] = useState('');

  const course = state.courses.find((c) => c.id === courseId);
  const items = state.scheduleItems
    .filter((item) => item.courseId === courseId)
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  const courseContacts = state.contacts.filter((c) => c.courseId === courseId);

  const completedCount = useMemo(() => items.filter((i) => i.completed).length, [items]);
  const progressPct = items.length ? Math.round((completedCount / items.length) * 100) : 0;
  const rmpUrl = useMemo(
    () => generateRateMyProfessorUrl(course?.instructor),
    [course?.instructor],
  );

  if (!course) {
    return (
      <div className="max-w-3xl space-y-4">
        <p className="text-sm text-muted-foreground">
          This course doesn&apos;t exist or has been removed.
        </p>
        <BackLink href="/dashboard">Back to dashboard</BackLink>
      </div>
    );
  }

  const handleEditCourse = async (values: CourseFormValues) => {
    if (!user) throw new Error('You must be signed in to edit a course.');
    await updateCourse(
      user.uid,
      course,
      {
        ...course,
        code: values.code,
        title: values.title,
        color: values.color,
        icon: values.icon,
        meetingTimes: values.meetingTimes ?? [],
        ...(values.instructor ? { instructor: values.instructor } : {}),
        ...(values.term ? { term: values.term } : {}),
        ...(values.modality ? { modality: values.modality } : {}),
      },
      dispatch,
    );
  };

  const handleDeleteCourse = async () => {
    if (!user) return;
    await deleteCourse(user.uid, course, items, dispatch, courseContacts);
    router.push('/dashboard');
  };

  const handleAddTask = async (values: ScheduleItemFormValues) => {
    if (!user) throw new Error('You must be signed in to add a task.');
    await createScheduleItem(
      user.uid,
      {
        id: crypto.randomUUID(),
        title: values.title,
        type: values.type,
        courseId: course.id,
        dueDate: new Date(`${values.dueDate}T23:59:00`).toISOString(),
        completed: false,
        priority: values.priority,
        ...(values.estimatedHours ? { estimatedHours: Number(values.estimatedHours) } : {}),
        ...(values.notes ? { notes: values.notes } : {}),
      },
      dispatch,
    );
  };

  const handleEditTask = async (values: ScheduleItemFormValues) => {
    if (!user || !editingItem) throw new Error('You must be signed in to edit a task.');
    await updateScheduleItem(
      user.uid,
      editingItem,
      {
        ...editingItem,
        title: values.title,
        type: values.type,
        courseId: values.courseId,
        dueDate: new Date(`${values.dueDate}T23:59:00`).toISOString(),
        priority: values.priority,
        ...(values.estimatedHours ? { estimatedHours: Number(values.estimatedHours) } : {}),
        ...(values.notes ? { notes: values.notes } : {}),
        ...(values.progress ? { progress: Number(values.progress) } : {}),
      },
      dispatch,
    );
  };

  const handleToggleComplete = async (item: ScheduleItem) => {
    if (!user) return;
    await updateScheduleItem(user.uid, item, { ...item, completed: !item.completed }, dispatch);
  };

  const handleDeleteTask = async (item: ScheduleItem) => {
    if (!user) return;
    await deleteScheduleItem(user.uid, item, dispatch);
    setConfirmingDeleteItemId(null);
  };

  const handleAddContact = async () => {
    if (!user || !newContact.fullName.trim()) return;
    setSavingContact(true);
    try {
      await createContact(
        user.uid,
        {
          id: crypto.randomUUID(),
          courseId: course.id,
          ...(course.term ? { term: course.term } : {}),
          role: newContact.role,
          fullName: newContact.fullName.trim(),
          source: 'manual',
          approved: true,
          ...(newContact.title.trim() ? { title: newContact.title.trim() } : {}),
          ...(newContact.howToAddress.trim()
            ? { howToAddress: newContact.howToAddress.trim() }
            : {}),
          ...(newContact.email.trim() ? { email: newContact.email.trim() } : {}),
          ...(newContact.officeHours.trim() ? { officeHours: newContact.officeHours.trim() } : {}),
          ...(newContact.officeLocation.trim()
            ? { officeLocation: newContact.officeLocation.trim() }
            : {}),
        },
        dispatch,
      );
      setNewContact(EMPTY_CONTACT_FORM);
      setAddContactOpen(false);
    } finally {
      setSavingContact(false);
    }
  };

  const handleStartEditContact = (contact: Contact) => {
    setEditingContactId(contact.id);
    setEditContact({
      fullName: contact.fullName,
      role: contact.role,
      title: contact.title ?? '',
      howToAddress: contact.howToAddress ?? '',
      email: contact.email ?? '',
      officeHours: contact.officeHours ?? '',
      officeLocation: contact.officeLocation ?? '',
    });
  };

  const handleSaveContact = async (contact: Contact) => {
    if (!user || !editContact.fullName.trim()) return;
    await updateContact(
      user.uid,
      contact,
      {
        ...contact,
        role: editContact.role,
        fullName: editContact.fullName.trim(),
        ...(editContact.title.trim() ? { title: editContact.title.trim() } : {}),
        ...(editContact.howToAddress.trim()
          ? { howToAddress: editContact.howToAddress.trim() }
          : {}),
        ...(editContact.email.trim() ? { email: editContact.email.trim() } : {}),
        ...(editContact.officeHours.trim() ? { officeHours: editContact.officeHours.trim() } : {}),
        ...(editContact.officeLocation.trim()
          ? { officeLocation: editContact.officeLocation.trim() }
          : {}),
      },
      dispatch,
    );
    setEditingContactId(null);
  };

  const handleStartEditObjective = (index: number) => {
    setObjectiveDraft(course.learningObjectives?.[index] ?? '');
    setEditingObjectiveIndex(index);
  };

  const handleCommitObjectiveEdit = async (index: number) => {
    if (!user) return;
    const current = [...(course.learningObjectives ?? [])];
    const trimmed = objectiveDraft.trim();
    if (trimmed) {
      current[index] = trimmed;
    } else {
      current.splice(index, 1);
    }
    await updateCourse(
      user.uid,
      course,
      { ...course, learningObjectives: current, learningObjectivesApproved: true },
      dispatch,
    );
    setEditingObjectiveIndex(null);
  };

  const handleDeleteObjective = async (index: number) => {
    if (!user) return;
    const current = [...(course.learningObjectives ?? [])];
    current.splice(index, 1);
    await updateCourse(
      user.uid,
      course,
      { ...course, learningObjectives: current, learningObjectivesApproved: true },
      dispatch,
    );
  };

  const handleAddObjective = async () => {
    if (!user) return;
    const trimmed = newObjectiveDraft.trim();
    if (!trimmed) {
      setAddingObjective(false);
      return;
    }
    const current = [...(course.learningObjectives ?? []), trimmed];
    await updateCourse(
      user.uid,
      course,
      { ...course, learningObjectives: current, learningObjectivesApproved: true },
      dispatch,
    );
    setNewObjectiveDraft('');
    setAddingObjective(false);
  };

  const handleExportICS = () => {
    const ics = generateICS(items, [course], new Date());
    const blob = createICSBlob(ics);
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = buildICSFilename(course.code);
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <div className="max-w-3xl space-y-6">
        <BackLink href="/dashboard">Back to dashboard</BackLink>

        <Card className="overflow-hidden rounded-2xl p-0">
          <div
            className={cn('h-2 w-full', courseSwatch(course.color).className)}
            style={courseSwatch(course.color).style}
          />
          <div className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <span
                  className={cn(
                    'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-lg font-bold text-white',
                    courseSwatch(course.color).className,
                  )}
                  style={courseSwatch(course.color).style}
                >
                  {course.code.slice(0, 1)}
                </span>
                <div>
                  <h1 className="text-xl font-bold text-foreground">
                    {course.code} · {course.title}
                  </h1>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {[course.instructor, course.term].filter(Boolean).join(' · ') ||
                      'No details yet'}
                  </p>
                </div>
              </div>
              {items.length > 0 && (
                <div className="flex shrink-0 flex-col items-center gap-1">
                  {items.length < RING_MIN_TASK_COUNT ? (
                    // Too few tracked tasks for a percentage to mean anything -
                    // a muted dashed outline stands in for the bold gradient
                    // arc so this doesn't read as a confident grade proxy.
                    <div
                      className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-dashed border-muted-foreground/30"
                      title="Not enough tracked tasks yet for a meaningful progress ring"
                    >
                      <span className="text-[11px] font-semibold text-muted-foreground">
                        {completedCount}/{items.length}
                      </span>
                    </div>
                  ) : (
                    <ProgressRing percent={progressPct} size={56} strokeWidth={6}>
                      <span className="text-xs font-bold text-foreground">{progressPct}%</span>
                    </ProgressRing>
                  )}
                  <span className="max-w-[88px] text-center text-[10px] leading-tight text-muted-foreground">
                    {completedCount} of {items.length} tracked task{items.length === 1 ? '' : 's'}{' '}
                    done
                  </span>
                </div>
              )}
            </div>

            {(course.meetingTimes?.length || course.modality || rmpUrl) && (
              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
                {course.modality && (
                  <span className="rounded-full bg-accent px-2.5 py-1 text-xs font-medium capitalize text-muted-foreground">
                    {course.modality}
                  </span>
                )}
                {course.meetingTimes?.map((m, i) => (
                  <span
                    key={i}
                    className="rounded-full bg-accent px-2.5 py-1 text-xs font-medium text-muted-foreground"
                  >
                    {WEEKDAY_ABBR[m.dayOfWeek]} {formatTimeLabel(m.startTime)}–
                    {formatTimeLabel(m.endTime)}
                    {m.location ? ` · ${m.location}` : ''}
                  </span>
                ))}
                {rmpUrl && (
                  <a
                    href={rmpUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-auto inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/20"
                  >
                    Rate My Professor
                    <svg
                      className="h-3.5 w-3.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2.5}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </a>
                )}
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
              <CardActionButton onClick={() => setEditCourseOpen(true)}>Edit</CardActionButton>
              {items.length > 0 && (
                <CardActionButton onClick={handleExportICS}>
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
                      d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3"
                    />
                  </svg>
                  Export .ics
                </CardActionButton>
              )}
              <div className="ml-auto">
                {confirmingDeleteCourse ? (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground">Delete course and its tasks?</span>
                    <button
                      onClick={handleDeleteCourse}
                      className="rounded-full bg-destructive/10 px-3 py-1.5 font-semibold text-destructive transition-colors hover:bg-destructive/20"
                    >
                      Confirm
                    </button>
                    <button
                      onClick={() => setConfirmingDeleteCourse(false)}
                      className="rounded-full px-3 py-1.5 text-muted-foreground transition-colors hover:bg-accent"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmingDeleteCourse(true)}
                    className="inline-flex items-center rounded-full px-3 py-1.5 text-xs font-semibold text-destructive transition-colors hover:bg-destructive/10"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          </div>
        </Card>

        <Card className="rounded-2xl p-6 space-y-4">
          <h2 className="text-base font-semibold text-foreground">Syllabus</h2>
          <SyllabusList userId={user?.uid} courseId={course.id} />
          <SyllabusUploader userId={user?.uid ?? ''} courseId={course.id} />
        </Card>

        <CourseAiSummaryCard course={course} />

        <Card className="rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">Contacts</h2>
            {!addContactOpen && (
              <CardActionButton variant="solid" withPlus onClick={() => setAddContactOpen(true)}>
                Add contact
              </CardActionButton>
            )}
          </div>

          {courseContacts.length === 0 && !addContactOpen && (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-border px-3 py-3">
              <p className="text-sm text-muted-foreground">No contacts yet for this course.</p>
              <button
                onClick={() => setAddContactOpen(true)}
                className="shrink-0 text-xs font-semibold text-primary hover:underline"
              >
                + Add
              </button>
            </div>
          )}

          {courseContacts.length > 0 && (
            <div className="flex flex-col gap-2">
              {courseContacts.map((contact) => (
                <div key={contact.id} className="rounded-lg border border-border p-3">
                  {editingContactId === contact.id ? (
                    <div className="space-y-3">
                      <ContactFormFields
                        value={editContact}
                        onChange={setEditContact}
                        idPrefix={`edit-${contact.id}`}
                      />
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setEditingContactId(null)}
                          className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleSaveContact(contact)}
                          disabled={!editContact.fullName.trim()}
                          className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={cn(
                              'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                              contact.role === 'professor'
                                ? 'bg-primary/10 text-primary'
                                : 'bg-accent text-muted-foreground',
                            )}
                          >
                            {contact.role === 'professor' ? 'Professor' : 'TA'}
                          </span>
                          <span className="text-sm font-semibold text-foreground">
                            {contact.fullName}
                          </span>
                          {contact.title && (
                            <span className="text-xs text-muted-foreground">{contact.title}</span>
                          )}
                        </div>
                        <button
                          onClick={() => handleStartEditContact(contact)}
                          className="shrink-0 text-xs font-semibold text-primary hover:underline"
                        >
                          Edit
                        </button>
                      </div>
                      {contact.howToAddress && (
                        <p className="text-xs text-muted-foreground">
                          Address as: {contact.howToAddress}
                        </p>
                      )}
                      {(contact.email || contact.officeHours || contact.officeLocation) && (
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          {contact.email && (
                            <a
                              href={`mailto:${contact.email}`}
                              className="font-medium text-primary hover:underline"
                            >
                              {contact.email}
                            </a>
                          )}
                          {(contact.officeHours || contact.officeLocation) && (
                            <span>
                              {[contact.officeHours, contact.officeLocation]
                                .filter(Boolean)
                                .join(' · ')}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {addContactOpen && (
            <div className="space-y-3 rounded-lg border border-border p-3">
              <ContactFormFields
                value={newContact}
                onChange={setNewContact}
                idPrefix="new-contact"
              />
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => {
                    setAddContactOpen(false);
                    setNewContact(EMPTY_CONTACT_FORM);
                  }}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddContact}
                  disabled={!newContact.fullName.trim() || savingContact}
                  className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {savingContact ? 'Saving…' : 'Save contact'}
                </button>
              </div>
            </div>
          )}
        </Card>

        <Card className="rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <h2 className="text-base font-semibold text-foreground">Learning Objectives</h2>
              {course.learningObjectives && course.learningObjectives.length > 0 && (
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                    course.learningObjectivesApproved
                      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                      : 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
                  )}
                >
                  {course.learningObjectivesApproved ? 'Approved' : 'Needs review'}
                </span>
              )}
            </div>
            {!addingObjective && (
              <button
                onClick={() => setAddingObjective(true)}
                className="shrink-0 text-xs font-semibold text-primary hover:underline"
              >
                + Add objective
              </button>
            )}
          </div>

          {course.learningObjectives && course.learningObjectives.length > 0 ? (
            <ul className="space-y-2.5">
              {course.learningObjectives.map((objective, i) =>
                editingObjectiveIndex === i ? (
                  <li key={i} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={objectiveDraft}
                      onChange={(e) => setObjectiveDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleCommitObjectiveEdit(i);
                        if (e.key === 'Escape') setEditingObjectiveIndex(null);
                      }}
                      className="flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => handleCommitObjectiveEdit(i)}
                      className="rounded p-1 text-primary hover:bg-primary/10"
                      aria-label="Save this objective"
                    >
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M4.5 12.75l6 6 9-13.5"
                        />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingObjectiveIndex(null)}
                      className="rounded p-1 text-muted-foreground hover:bg-muted"
                      aria-label="Cancel editing"
                    >
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </li>
                ) : (
                  <li
                    key={i}
                    className="group flex items-start justify-between gap-3 text-sm text-foreground"
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                      <span className="leading-relaxed break-words">
                        {renderInlineBold(objective)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={() => handleStartEditObjective(i)}
                        className="rounded p-1 text-muted-foreground hover:text-primary transition-colors"
                        aria-label="Edit objective"
                      >
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
                            d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125"
                          />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteObjective(i)}
                        className="rounded p-1 text-muted-foreground hover:text-destructive transition-colors"
                        aria-label="Delete objective"
                      >
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
                            d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                          />
                        </svg>
                      </button>
                    </div>
                  </li>
                ),
              )}
            </ul>
          ) : (
            !addingObjective && (
              <p className="text-sm text-muted-foreground">No learning objectives yet.</p>
            )
          )}

          {addingObjective && (
            <div className="space-y-2 rounded-lg border border-border p-3">
              <input
                type="text"
                value={newObjectiveDraft}
                onChange={(e) => setNewObjectiveDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddObjective();
                  if (e.key === 'Escape') setAddingObjective(false);
                }}
                placeholder="e.g. **Design** multi-tier web applications"
                className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Use **bold** for emphasis. Press Enter to save.
              </p>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAddingObjective(false)}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAddObjective}
                  disabled={!newObjectiveDraft.trim()}
                  className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                  Add
                </button>
              </div>
            </div>
          )}
        </Card>

        <Card className="rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-foreground">Tasks</h2>
            <CardActionButton variant="solid" withPlus onClick={() => setAddTaskOpen(true)}>
              Add Task
            </CardActionButton>
          </div>

          {items.length === 0 ? (
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
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              }
              title="No tasks for this course yet"
              description="Add one, or upload a syllabus above to extract tasks automatically."
              action={{ label: '+ Add Task', onClick: () => setAddTaskOpen(true) }}
            />
          ) : (
            <div className="flex flex-col gap-2">
              {items.map((item) => {
                const overdue = !item.completed && new Date(item.dueDate) < new Date();
                return (
                  <TaskRow
                    key={item.id}
                    variant={state.preferences.taskRowVariant}
                    title={item.title}
                    href={'/tasks/' + item.id}
                    type={item.type}
                    courseColor={course.color}
                    courseIcon={course.icon}
                    completed={item.completed}
                    progress={item.progress}
                    priority={item.priority}
                    onToggleComplete={user ? () => handleToggleComplete(item) : undefined}
                    trailing={
                      <>
                        {/* Stakes badge (CO-5) - a 25%-of-grade exam and a
                            zero-weight attendance check otherwise render as
                            visual near-twins in this list. Only items with a
                            real grade weight get the badge, so it stays a
                            signal rather than noise on every row. Reuses
                            TaskRow's existing `trailing` slot; TaskRow itself
                            is untouched. */}
                        {item.gradeWeight != null && item.gradeWeight > 0 && (
                          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-400">
                            {item.gradeWeight}% grade
                          </span>
                        )}
                        {overdue && (
                          <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive">
                            Overdue
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground">
                          Due {dueDateFormatter.format(new Date(item.dueDate))}
                        </span>
                        <button
                          onClick={() => setEditingItem(item)}
                          className="rounded-full px-2.5 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary/10"
                        >
                          Edit
                        </button>
                        {confirmingDeleteItemId === item.id ? (
                          <div className="flex items-center gap-2 text-xs">
                            <button
                              onClick={() => handleDeleteTask(item)}
                              className="font-semibold text-destructive hover:underline"
                            >
                              Confirm
                            </button>
                            <button
                              onClick={() => setConfirmingDeleteItemId(null)}
                              className="text-muted-foreground hover:underline"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmingDeleteItemId(item.id)}
                            className="text-xs font-semibold text-destructive hover:underline"
                          >
                            Delete
                          </button>
                        )}
                      </>
                    }
                  />
                );
              })}
            </div>
          )}
        </Card>
      </div>

      <CourseFormModal
        open={editCourseOpen}
        onClose={() => setEditCourseOpen(false)}
        onSubmit={handleEditCourse}
        initialCourse={course}
      />
      <TaskFormModal
        open={addTaskOpen}
        onClose={() => setAddTaskOpen(false)}
        onSubmit={handleAddTask}
        courses={[course]}
      />
      <TaskFormModal
        open={editingItem !== null}
        onClose={() => setEditingItem(null)}
        onSubmit={handleEditTask}
        courses={[course]}
        initialItem={editingItem ?? undefined}
      />
    </>
  );
}
