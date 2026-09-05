'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BackLink } from '@/components/ui/BackLink';
import { Card } from '@/components/ui/Card';
import { CardActionButton } from '@/components/ui/CardAction';
import { EmptyState } from '@/components/ui/EmptyState';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { TaskRow } from '@/components/ui/TaskRow';
import { useToast } from '@/components/ui/Toast';
import { useAppState } from '@/context/AppStateContext';
import { useAuth } from '@/context/AuthContext';
import { updateCourse, deleteCourse } from '@/lib/firestore/courses';
import {
  createScheduleItem,
  updateScheduleItem,
  deleteScheduleItem,
} from '@/lib/firestore/scheduleItems';
import { createContact, updateContact, deleteContact } from '@/lib/firestore/contacts';
import { CourseFormModal } from '@/components/courses/CourseFormModal';
import { GradeCalculatorModal } from '@/components/courses/GradeCalculatorModal';
import { TaskFormModal } from '@/components/tasks/TaskFormModal';
import { SyllabusUploader } from '@/components/syllabus/SyllabusUploader';
import { SyllabusList } from '@/components/syllabus/SyllabusList';
import { SyllabusDiffModal } from '@/components/syllabus/SyllabusDiffModal';
import { useSyllabi } from '@/lib/firestore/useSyllabi';
import { getPrimarySyllabus } from '@/lib/firestore/syllabi';
import type { SyllabusUpload } from '@/types/syllabus';
import { CourseAiSummaryCard } from '@/components/courses/CourseAiSummaryCard';
import { SourcesCard } from '@/components/courses/SourcesCard';
import { ExamCramPlanCard } from '@/components/courses/ExamCramPlanCard';
import { AttendanceGauge } from '@/components/courses/AttendanceGauge';
import { formatTimeLabel } from '@/lib/calendar/meetings';
import { buildICSFilename, createICSBlob, generateICS } from '@/lib/export/ics';
import { generateRateMyProfessorUrl } from '@/lib/export/rateMyProfessor';
import { courseSwatch } from '@/lib/courseColors';
import { normalizeMaterials, sumMaterialCosts } from '@/lib/courses/materials';
import { cn } from '@/lib/utils';
import type { CourseFormValues } from '@/lib/validation/course';
import type { ScheduleItemFormValues } from '@/lib/validation/scheduleItem';
import type { Course, ScheduleItem, Contact, ContactRole, AbsenceRecord } from '@/types/schedule';

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
  'w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary';

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
  const { showSuccess, showError } = useToast();
  const syllabi = useSyllabi(user?.uid, courseId);
  const currentPrimarySyllabus = getPrimarySyllabus(syllabi) ?? null;
  const [syllabusDiff, setSyllabusDiff] = useState<{
    original: SyllabusUpload;
    revised: SyllabusUpload;
  } | null>(null);

  const [editCourseOpen, setEditCourseOpen] = useState(false);
  const [gradeCalculatorOpen, setGradeCalculatorOpen] = useState(false);
  const [addTaskOpen, setAddTaskOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ScheduleItem | null>(null);
  const [confirmingDeleteCourse, setConfirmingDeleteCourse] = useState(false);
  const [isDeletingCourse, setIsDeletingCourse] = useState(false);
  const [confirmingDeleteItemId, setConfirmingDeleteItemId] = useState<string | null>(null);
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);
  const [confirmingDeleteObjectiveIndex, setConfirmingDeleteObjectiveIndex] = useState<
    number | null
  >(null);
  const [deletingObjectiveIndex, setDeletingObjectiveIndex] = useState<number | null>(null);

  const [addContactOpen, setAddContactOpen] = useState(false);
  const [confirmingDeleteContactId, setConfirmingDeleteContactId] = useState<string | null>(null);
  const [deletingContactId, setDeletingContactId] = useState<string | null>(null);
  const [newContact, setNewContact] = useState<ContactFormState>(EMPTY_CONTACT_FORM);
  const [savingContact, setSavingContact] = useState(false);
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [editContact, setEditContact] = useState<ContactFormState>(EMPTY_CONTACT_FORM);

  const [editingObjectiveIndex, setEditingObjectiveIndex] = useState<number | null>(null);
  const [objectiveDraft, setObjectiveDraft] = useState('');
  const [addingObjective, setAddingObjective] = useState(false);
  const [newObjectiveDraft, setNewObjectiveDraft] = useState('');

  const [confirmingDeleteMaterialIndex, setConfirmingDeleteMaterialIndex] = useState<number | null>(
    null,
  );
  const [deletingMaterialIndex, setDeletingMaterialIndex] = useState<number | null>(null);
  const [editingMaterialIndex, setEditingMaterialIndex] = useState<number | null>(null);
  const [materialDraft, setMaterialDraft] = useState('');
  const [materialCostDraft, setMaterialCostDraft] = useState('');
  const [addingMaterial, setAddingMaterial] = useState(false);
  const [newMaterialDraft, setNewMaterialDraft] = useState('');
  const [newMaterialCostDraft, setNewMaterialCostDraft] = useState('');

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

  const courseMaterials = normalizeMaterials(course.materials);
  const materialsTotal = sumMaterialCosts(courseMaterials);

  const handleEditCourse = async (values: CourseFormValues) => {
    if (!user) throw new Error('You must be signed in to edit a course.');
    const updatedCourse: Course = {
      ...course,
      code: values.code,
      title: values.title,
      color: values.color,
      icon: values.icon,
      meetingTimes: values.meetingTimes ?? [],
      skipDates: values.skipDates ?? [],
      ...(values.instructor ? { instructor: values.instructor } : {}),
      ...(values.modality ? { modality: values.modality } : {}),
    };
    if (values.term) {
      updatedCourse.term = values.term;
    } else {
      delete updatedCourse.term;
    }

    await updateCourse(user.uid, course, updatedCourse, dispatch, courseContacts);
  };

  const handleDeleteCourse = async () => {
    if (!user) return;
    setIsDeletingCourse(true);
    try {
      await deleteCourse(user.uid, course, items, dispatch, courseContacts);
      showSuccess('Course deleted', `${course.code} and its tasks were removed.`);
      router.push('/dashboard');
    } catch (err) {
      showError('Could not delete course', err instanceof Error ? err.message : undefined);
    } finally {
      setIsDeletingCourse(false);
    }
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
        ...(values.gradeWeight ? { gradeWeight: Number(values.gradeWeight) } : {}),
        ...(values.gradeCategory ? { gradeCategory: values.gradeCategory } : {}),
        ...(values.assignedTo ? { assignedTo: values.assignedTo } : {}),
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
        ...(values.gradeWeight ? { gradeWeight: Number(values.gradeWeight) } : {}),
        ...(values.gradeCategory ? { gradeCategory: values.gradeCategory } : {}),
        ...(values.assignedTo ? { assignedTo: values.assignedTo } : {}),
      },
      dispatch,
    );
  };

  const handleToggleComplete = async (item: ScheduleItem) => {
    if (!user) return;
    try {
      await updateScheduleItem(user.uid, item, { ...item, completed: !item.completed }, dispatch);
    } catch (err) {
      console.error('Failed to toggle task:', err);
      showError("Couldn't update that task. Try again in a moment.");
    }
  };

  const handleDeleteTask = async (item: ScheduleItem) => {
    if (!user) return;
    setDeletingItemId(item.id);
    try {
      await deleteScheduleItem(user.uid, item, dispatch);
      setConfirmingDeleteItemId(null);
      showSuccess('Task deleted', `"${item.title}" was removed.`);
    } catch (err) {
      showError('Could not delete task', err instanceof Error ? err.message : undefined);
    } finally {
      setDeletingItemId(null);
    }
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
    } catch (err) {
      showError('Could not add contact', err instanceof Error ? err.message : undefined);
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
    try {
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
          ...(editContact.officeHours.trim()
            ? { officeHours: editContact.officeHours.trim() }
            : {}),
          ...(editContact.officeLocation.trim()
            ? { officeLocation: editContact.officeLocation.trim() }
            : {}),
        },
        dispatch,
      );
      setEditingContactId(null);
    } catch (err) {
      showError('Could not save contact', err instanceof Error ? err.message : undefined);
    }
  };

  const handleDeleteContact = async (contact: Contact) => {
    if (!user) return;
    setDeletingContactId(contact.id);
    try {
      await deleteContact(user.uid, contact, dispatch);
      setConfirmingDeleteContactId(null);
      showSuccess('Contact deleted', `${contact.fullName} was removed.`);
    } catch (err) {
      showError('Could not delete contact', err instanceof Error ? err.message : undefined);
    } finally {
      setDeletingContactId(null);
    }
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
    try {
      await updateCourse(
        user.uid,
        course,
        { ...course, learningObjectives: current, learningObjectivesApproved: true },
        dispatch,
      );
      setEditingObjectiveIndex(null);
    } catch (err) {
      showError('Could not save that objective', err instanceof Error ? err.message : undefined);
    }
  };

  const handleDeleteObjective = async (index: number) => {
    if (!user) return;
    setDeletingObjectiveIndex(index);
    try {
      const current = [...(course.learningObjectives ?? [])];
      current.splice(index, 1);
      await updateCourse(
        user.uid,
        course,
        { ...course, learningObjectives: current, learningObjectivesApproved: true },
        dispatch,
      );
      setConfirmingDeleteObjectiveIndex(null);
    } finally {
      setDeletingObjectiveIndex(null);
    }
  };

  const handleAddObjective = async () => {
    if (!user) return;
    const trimmed = newObjectiveDraft.trim();
    if (!trimmed) {
      setAddingObjective(false);
      return;
    }
    const current = [...(course.learningObjectives ?? []), trimmed];
    try {
      await updateCourse(
        user.uid,
        course,
        { ...course, learningObjectives: current, learningObjectivesApproved: true },
        dispatch,
      );
      setNewObjectiveDraft('');
      setAddingObjective(false);
    } catch (err) {
      showError('Could not add that objective', err instanceof Error ? err.message : undefined);
    }
  };

  const handleStartEditMaterial = (index: number) => {
    const material = courseMaterials[index];
    setMaterialDraft(material?.name ?? '');
    setMaterialCostDraft(material?.cost !== undefined ? String(material.cost) : '');
    setEditingMaterialIndex(index);
  };

  const handleCommitMaterialEdit = async (index: number) => {
    if (!user) return;
    const current = [...courseMaterials];
    const trimmedName = materialDraft.trim();
    const parsedCost = materialCostDraft.trim() ? Number(materialCostDraft) : NaN;
    if (trimmedName) {
      current[index] = {
        name: trimmedName,
        ...(!Number.isNaN(parsedCost) && parsedCost >= 0 ? { cost: parsedCost } : {}),
      };
    } else {
      current.splice(index, 1);
    }
    try {
      await updateCourse(user.uid, course, { ...course, materials: current }, dispatch);
      setEditingMaterialIndex(null);
    } catch (err) {
      showError('Could not save that material', err instanceof Error ? err.message : undefined);
    }
  };

  const handleDeleteMaterial = async (index: number) => {
    if (!user) return;
    setDeletingMaterialIndex(index);
    try {
      const current = [...courseMaterials];
      current.splice(index, 1);
      await updateCourse(user.uid, course, { ...course, materials: current }, dispatch);
      setConfirmingDeleteMaterialIndex(null);
    } finally {
      setDeletingMaterialIndex(null);
    }
  };

  const handleAddMaterial = async () => {
    if (!user) return;
    const trimmedName = newMaterialDraft.trim();
    if (!trimmedName) {
      setAddingMaterial(false);
      return;
    }
    const parsedCost = newMaterialCostDraft.trim() ? Number(newMaterialCostDraft) : NaN;
    const current = [
      ...courseMaterials,
      {
        name: trimmedName,
        ...(!Number.isNaN(parsedCost) && parsedCost >= 0 ? { cost: parsedCost } : {}),
      },
    ];
    try {
      await updateCourse(user.uid, course, { ...course, materials: current }, dispatch);
      setNewMaterialDraft('');
      setNewMaterialCostDraft('');
      setAddingMaterial(false);
    } catch (err) {
      showError('Could not add that material', err instanceof Error ? err.message : undefined);
    }
  };

  const handleLogAbsence = async (record: AbsenceRecord) => {
    if (!user) return;
    const current = [record, ...(course.absences ?? [])];
    try {
      await updateCourse(user.uid, course, { ...course, absences: current }, dispatch);
    } catch (err) {
      showError('Could not save that absence', err instanceof Error ? err.message : undefined);
    }
  };

  const handleDeleteAbsence = async (id: string) => {
    if (!user) return;
    const current = (course.absences ?? []).filter((a) => a.id !== id);
    try {
      await updateCourse(user.uid, course, { ...course, absences: current }, dispatch);
    } catch (err) {
      showError('Could not remove that absence', err instanceof Error ? err.message : undefined);
    }
  };

  const handleExportICS = () => {
    if (items.length === 0) {
      showError('Nothing to export', 'This course has no tasks yet.');
      return;
    }
    try {
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
      showSuccess(
        'Calendar exported',
        `${items.length} ${items.length === 1 ? 'item' : 'items'} saved as .ics.`,
      );
    } catch (err) {
      showError('Could not export calendar', err instanceof Error ? err.message : undefined);
    }
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
              <CardActionButton onClick={() => setGradeCalculatorOpen(true)}>
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
                    d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                  />
                </svg>
                Grade Calculator
              </CardActionButton>
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
                      disabled={isDeletingCourse}
                      className="rounded-full bg-destructive/10 px-3 py-1.5 font-semibold text-destructive transition-colors hover:bg-destructive/20 disabled:opacity-50"
                    >
                      {isDeletingCourse ? 'Deleting…' : 'Confirm'}
                    </button>
                    <button
                      onClick={() => setConfirmingDeleteCourse(false)}
                      disabled={isDeletingCourse}
                      className="rounded-full px-3 py-1.5 text-muted-foreground transition-colors hover:bg-accent disabled:opacity-50"
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
          <SyllabusUploader
            userId={user?.uid ?? ''}
            courseId={course.id}
            currentPrimarySyllabus={currentPrimarySyllabus}
            onUploaded={(newUpload, previousPrimary) => {
              // Only offer a diff when there's something real to compare -
              // a genuinely new upload replacing an older one, with text
              // extracted from both. A course's first-ever upload, or one
              // where extraction failed on either side, has nothing to
              // diff against, so it's skipped rather than shown empty.
              if (
                previousPrimary &&
                previousPrimary.id !== newUpload.id &&
                previousPrimary.rawText &&
                newUpload.rawText
              ) {
                setSyllabusDiff({ original: previousPrimary, revised: newUpload });
              }
            }}
          />
        </Card>

        {syllabusDiff && (
          <SyllabusDiffModal
            isOpen
            onClose={() => setSyllabusDiff(null)}
            courseCode={course.code}
            courseTitle={course.title}
            originalSyllabusText={syllabusDiff.original.rawText ?? ''}
            revisedSyllabusText={syllabusDiff.revised.rawText ?? ''}
            onApplyChanges={() => {
              // The new upload already became primary at upload time
              // (useUploadSyllabus) - reviewing changes here doesn't need
              // its own persistence step, just an acknowledgement.
              showSuccess(
                'Reviewed',
                `${syllabusDiff.revised.fileName} is the current version for this course.`,
              );
              setSyllabusDiff(null);
            }}
          />
        )}

        <CourseAiSummaryCard course={course} />

        <AttendanceGauge
          courseCode={course.code}
          courseTitle={course.title}
          maxAllowedAbsences={course.notes?.toLowerCase().includes('attendance') ? 3 : 4}
          initialAbsences={course.absences ?? []}
          onAbsenceLogged={handleLogAbsence}
          onAbsenceDeleted={handleDeleteAbsence}
        />

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
                    d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
                  />
                </svg>
              }
              title="No contacts yet for this course"
              description="Add a professor or TA, or upload a syllabus above to extract contacts automatically."
              action={{ label: '+ Add contact', onClick: () => setAddContactOpen(true) }}
            />
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
                        <div className="flex shrink-0 items-center gap-1.5">
                          <button
                            onClick={() => handleStartEditContact(contact)}
                            className="rounded-full px-2.5 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary/10"
                          >
                            Edit
                          </button>
                          {confirmingDeleteContactId === contact.id ? (
                            <div className="flex items-center gap-1.5 text-xs">
                              <button
                                onClick={() => handleDeleteContact(contact)}
                                disabled={deletingContactId === contact.id}
                                className="rounded-full bg-destructive/10 px-2.5 py-1 font-semibold text-destructive transition-colors hover:bg-destructive/20 disabled:opacity-50"
                              >
                                {deletingContactId === contact.id ? 'Deleting…' : 'Confirm'}
                              </button>
                              <button
                                onClick={() => setConfirmingDeleteContactId(null)}
                                disabled={deletingContactId === contact.id}
                                className="rounded-full px-2.5 py-1 text-muted-foreground transition-colors hover:bg-accent disabled:opacity-50"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setConfirmingDeleteContactId(contact.id)}
                              className="rounded-full px-2.5 py-1 text-xs font-semibold text-destructive transition-colors hover:bg-destructive/10"
                            >
                              Delete
                            </button>
                          )}
                        </div>
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
            <h2 className="text-base font-semibold text-foreground">Learning Objectives</h2>
            {!addingObjective && (
              <CardActionButton variant="solid" withPlus onClick={() => setAddingObjective(true)}>
                Add objective
              </CardActionButton>
            )}
          </div>

          {course.learningObjectives && course.learningObjectives.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {course.learningObjectives.map((objective, i) =>
                editingObjectiveIndex === i ? (
                  <li
                    key={i}
                    className="flex items-center gap-2 rounded-lg border border-border p-3"
                  >
                    <input
                      type="text"
                      value={objectiveDraft}
                      onChange={(e) => setObjectiveDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleCommitObjectiveEdit(i);
                        if (e.key === 'Escape') setEditingObjectiveIndex(null);
                      }}
                      className="flex-1 rounded-lg border border-border bg-input px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
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
                    className="group flex items-start justify-between gap-3 rounded-lg border border-border p-3 text-sm text-foreground transition-colors hover:border-primary/30"
                  >
                    <div className="min-w-0">
                      <span className="leading-relaxed break-words">
                        {renderInlineBold(objective)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 opacity-80 transition-opacity group-hover:opacity-100">
                      {confirmingDeleteObjectiveIndex === i ? (
                        <div className="flex items-center gap-1.5 text-xs whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleDeleteObjective(i)}
                            disabled={deletingObjectiveIndex === i}
                            className="rounded-full bg-destructive/10 px-2.5 py-1 font-semibold text-destructive transition-colors hover:bg-destructive/20 disabled:opacity-50"
                          >
                            {deletingObjectiveIndex === i ? 'Deleting…' : 'Confirm'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmingDeleteObjectiveIndex(null)}
                            disabled={deletingObjectiveIndex === i}
                            className="rounded-full px-2.5 py-1 text-muted-foreground transition-colors hover:bg-accent disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => handleStartEditObjective(i)}
                            className="rounded-full px-2.5 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary/10"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmingDeleteObjectiveIndex(i)}
                            className="rounded-full px-2.5 py-1 text-xs font-semibold text-destructive transition-colors hover:bg-destructive/10"
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </li>
                ),
              )}
            </ul>
          ) : (
            !addingObjective && (
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
                      d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                }
                title="No learning objectives yet"
                description="Add one, or upload a syllabus above to extract objectives automatically."
                action={{ label: '+ Add objective', onClick: () => setAddingObjective(true) }}
              />
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
                className="w-full rounded-lg border border-border bg-input px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
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

        <Card className="rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-foreground">Materials</h2>
            {!addingMaterial && (
              <CardActionButton variant="solid" withPlus onClick={() => setAddingMaterial(true)}>
                Add material
              </CardActionButton>
            )}
          </div>

          {courseMaterials.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {courseMaterials.map((material, i) =>
                editingMaterialIndex === i ? (
                  <li
                    key={i}
                    className="flex items-center gap-2 rounded-lg border border-border p-3"
                  >
                    <input
                      type="text"
                      value={materialDraft}
                      onChange={(e) => setMaterialDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleCommitMaterialEdit(i);
                        if (e.key === 'Escape') setEditingMaterialIndex(null);
                      }}
                      className="flex-1 rounded-lg border border-border bg-input px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                      autoFocus
                    />
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={materialCostDraft}
                      onChange={(e) => setMaterialCostDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleCommitMaterialEdit(i);
                        if (e.key === 'Escape') setEditingMaterialIndex(null);
                      }}
                      placeholder="Cost"
                      aria-label="Material cost"
                      className="w-24 rounded-lg border border-border bg-input px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                    <button
                      type="button"
                      onClick={() => handleCommitMaterialEdit(i)}
                      className="rounded p-1 text-primary hover:bg-primary/10"
                      aria-label="Save this material"
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
                      onClick={() => setEditingMaterialIndex(null)}
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
                    className="group flex items-start justify-between gap-3 rounded-lg border border-border p-3 text-sm text-foreground transition-colors hover:border-primary/30"
                  >
                    <div className="min-w-0 flex flex-wrap items-center gap-2">
                      <span className="leading-relaxed break-words">{material.name}</span>
                      {material.cost !== undefined && (
                        <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                          ${material.cost.toFixed(2)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0 opacity-80 transition-opacity group-hover:opacity-100">
                      {confirmingDeleteMaterialIndex === i ? (
                        <div className="flex items-center gap-1.5 text-xs whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleDeleteMaterial(i)}
                            disabled={deletingMaterialIndex === i}
                            className="rounded-full bg-destructive/10 px-2.5 py-1 font-semibold text-destructive transition-colors hover:bg-destructive/20 disabled:opacity-50"
                          >
                            {deletingMaterialIndex === i ? 'Deleting…' : 'Confirm'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmingDeleteMaterialIndex(null)}
                            disabled={deletingMaterialIndex === i}
                            className="rounded-full px-2.5 py-1 text-muted-foreground transition-colors hover:bg-accent disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => handleStartEditMaterial(i)}
                            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                            aria-label="Edit material"
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
                            onClick={() => setConfirmingDeleteMaterialIndex(i)}
                            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                            aria-label="Delete material"
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
                        </>
                      )}
                    </div>
                  </li>
                ),
              )}
            </ul>
          ) : (
            !addingMaterial && (
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
                      d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"
                    />
                  </svg>
                }
                title="No materials yet"
                description="Add a textbook, calculator, or other required supply, or upload a syllabus above to extract them automatically."
                action={{ label: '+ Add material', onClick: () => setAddingMaterial(true) }}
              />
            )
          )}

          {materialsTotal > 0 && (
            <div className="flex items-center justify-between rounded-lg bg-primary/10 px-3 py-2 text-sm font-semibold text-primary">
              <span>Course materials total</span>
              <span>${materialsTotal.toFixed(2)}</span>
            </div>
          )}

          {addingMaterial && (
            <div className="space-y-2 rounded-lg border border-border p-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newMaterialDraft}
                  onChange={(e) => setNewMaterialDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddMaterial();
                    if (e.key === 'Escape') setAddingMaterial(false);
                  }}
                  placeholder="e.g. Introduction to Algorithms, 3rd Edition"
                  className="flex-1 rounded-lg border border-border bg-input px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                  autoFocus
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={newMaterialCostDraft}
                  onChange={(e) => setNewMaterialCostDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddMaterial();
                    if (e.key === 'Escape') setAddingMaterial(false);
                  }}
                  placeholder="Cost"
                  aria-label="Material cost"
                  className="w-24 rounded-lg border border-border bg-input px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Cost is optional. Press Enter to save.
              </p>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAddingMaterial(false)}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAddMaterial}
                  disabled={!newMaterialDraft.trim()}
                  className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                  Add
                </button>
              </div>
            </div>
          )}
        </Card>

        <SourcesCard course={course} />

        <ExamCramPlanCard course={course} />

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
                    assignedTo={item.assignedTo}
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
                          <div className="flex items-center gap-1.5 text-xs">
                            <button
                              onClick={() => handleDeleteTask(item)}
                              disabled={deletingItemId === item.id}
                              className="rounded-full bg-destructive/10 px-2.5 py-1 font-semibold text-destructive transition-colors hover:bg-destructive/20 disabled:opacity-50"
                            >
                              {deletingItemId === item.id ? 'Deleting…' : 'Confirm'}
                            </button>
                            <button
                              onClick={() => setConfirmingDeleteItemId(null)}
                              disabled={deletingItemId === item.id}
                              className="rounded-full px-2.5 py-1 text-muted-foreground transition-colors hover:bg-accent disabled:opacity-50"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmingDeleteItemId(item.id)}
                            className="rounded-full px-2.5 py-1 text-xs font-semibold text-destructive transition-colors hover:bg-destructive/10"
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
      <GradeCalculatorModal
        isOpen={gradeCalculatorOpen}
        onClose={() => setGradeCalculatorOpen(false)}
        initialCourseId={course.id}
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
