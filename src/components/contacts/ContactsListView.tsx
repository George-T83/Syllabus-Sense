'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/Card';
import { CardActionButton } from '@/components/ui/CardAction';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { useUndoToast } from '@/hooks/useUndoToast';
import { useAppState } from '@/context/AppStateContext';
import { courseTermLabel, resolveActiveTerm } from '@/lib/terms/termResolve';
import { termLabelKey } from '@/lib/terms/standardTerms';
import { useAuth } from '@/context/AuthContext';
import { createContact, updateContact, deleteContact } from '@/lib/firestore/contacts';
import { createScheduleItem } from '@/lib/firestore/scheduleItems';
import { useModalA11y } from '@/hooks/useModalA11y';
import { useDirtyClose } from '@/hooks/useDirtyClose';
import { DiscardConfirmCard } from '@/components/ui/DiscardConfirmCard';
import type { Contact, ContactRole, Course } from '@/types/schedule';
import { cn, normalizeContactName } from '@/lib/utils';

const ROLE_LABEL: Record<ContactRole, string> = {
  professor: 'Professor',
  ta: 'TA',
  classmate: 'Classmate',
};

interface ContactFormValues {
  courseId: string;
  role: ContactRole;
  fullName: string;
  title: string;
  howToAddress: string;
  email: string;
  officeHours: string;
  officeLocation: string;
}

function emptyFormValues(defaultCourseId = ''): ContactFormValues {
  return {
    courseId: defaultCourseId,
    role: 'professor',
    fullName: '',
    title: '',
    howToAddress: '',
    email: '',
    officeHours: '',
    officeLocation: '',
  };
}

function courseLabel(course: Course | undefined): string {
  if (!course) return 'Unknown course';
  return `${course.code} — ${course.title}`;
}

import { ProfessorEmailDrafterModal } from '@/components/contacts/ProfessorEmailDrafterModal';
import { ContactShareModal } from '@/components/contacts/ContactShareModal';
import { ScheduleOfficeVisitModal } from '@/components/contacts/ScheduleOfficeVisitModal';
import { PageHeader } from '@/components/ui/PageHeader';
import { RowActionButton } from '@/components/ui/RowActionButton';
import { validateContactFields } from '@/lib/validation/contact';

export function ContactsListView() {
  const { state, dispatch } = useAppState();
  const { user } = useAuth();
  const { showSuccess, showError } = useToast();
  const showUndo = useUndoToast();
  const { contacts, courses } = state;

  const [search, setSearch] = useState('');
  const [termFilter, setTermFilter] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [drafterContact, setDrafterContact] = useState<Contact | null>(null);
  const [shareContact, setShareContact] = useState<Contact | null>(null);
  const [schedulingContact, setSchedulingContact] = useState<Contact | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && contacts.length > 0) {
      if (window.location.search.includes('email=true')) {
        setDrafterContact(contacts[0]);
      }
      if (
        window.location.search.includes('vcard=true') ||
        window.location.search.includes('qr=true')
      ) {
        setShareContact(contacts[0]);
      }
    }
  }, [contacts]);

  const courseById = useMemo(() => {
    const map = new Map<string, Course>();
    courses.forEach((c) => map.set(c.id, c));
    return map;
  }, [courses]);

  const terms = useMemo(
    () => Array.from(new Set(contacts.map((c) => c.term).filter(Boolean))) as string[],
    [contacts],
  );

  // Contacts carry their course's term label as text, so the active term is
  // matched by label (ignoring case and spacing), not by id.
  const activeTerm = useMemo(
    () => resolveActiveTerm(state.selectedTerm, courses, state.terms),
    [state.selectedTerm, courses, state.terms],
  );
  const activeTermLabel = activeTerm
    ? (terms.find((t) => termLabelKey(t) === termLabelKey(activeTerm.label)) ?? activeTerm.label)
    : null;
  const effectiveTermFilter = termFilter ?? activeTermLabel ?? 'all';
  const inFilterTerm = (c: Contact) =>
    termLabelKey(c.term ?? '') === termLabelKey(effectiveTermFilter);
  const hiddenByTermCount =
    effectiveTermFilter !== 'all' ? contacts.filter((c) => !inFilterTerm(c)).length : 0;

  const filteredContacts = useMemo(() => {
    let result = contacts.slice();

    if (effectiveTermFilter !== 'all') result = result.filter(inFilterTerm);

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter((c) => {
        const course = courseById.get(c.courseId);
        return (
          c.fullName.toLowerCase().includes(q) ||
          course?.code.toLowerCase().includes(q) ||
          course?.title.toLowerCase().includes(q)
        );
      });
    }

    return result;
  }, [contacts, search, effectiveTermFilter, courseById]);

  // Grouped by person (normalized full name), not by course - the same
  // professor teaching two courses gets one card, not two. Each Contact
  // record is still course-scoped underneath (office hours/location can
  // legitimately differ by course), so a group just collects that person's
  // per-course records; the card lists every course from its own records.
  // Sorted alphabetically since there's no course order to inherit anymore.
  const personGroups = useMemo(() => {
    const byPerson = new Map<string, Contact[]>();
    filteredContacts.forEach((c) => {
      const key = normalizeContactName(c.fullName) || c.id;
      const list = byPerson.get(key) ?? [];
      list.push(c);
      byPerson.set(key, list);
    });

    return Array.from(byPerson.values())
      .map((records) => ({ primary: records[0], records }))
      .sort((a, b) => a.primary.fullName.localeCompare(b.primary.fullName));
  }, [filteredContacts]);

  const openCreate = () => {
    setEditingContact(null);
    setFormOpen(true);
  };

  const openEdit = (contact: Contact) => {
    setEditingContact(contact);
    setFormOpen(true);
  };

  const closeForm = () => setFormOpen(false);

  const handleSubmit = async (values: ContactFormValues) => {
    if (!user) throw new Error('You must be signed in to save a contact.');

    if (editingContact) {
      const updated: Contact = {
        id: editingContact.id,
        courseId: editingContact.courseId,
        ...(editingContact.term ? { term: editingContact.term } : {}),
        role: values.role,
        fullName: values.fullName.trim(),
        ...(values.title.trim() ? { title: values.title.trim() } : {}),
        ...(values.howToAddress.trim() ? { howToAddress: values.howToAddress.trim() } : {}),
        ...(values.email.trim() ? { email: values.email.trim() } : {}),
        ...(values.officeHours.trim() ? { officeHours: values.officeHours.trim() } : {}),
        ...(values.officeLocation.trim() ? { officeLocation: values.officeLocation.trim() } : {}),
        ...(editingContact.source ? { source: editingContact.source } : {}),
        ...(editingContact.approved !== undefined ? { approved: editingContact.approved } : {}),
        ...(editingContact.fieldApprovals ? { fieldApprovals: editingContact.fieldApprovals } : {}),
        ...(editingContact.sample ? { sample: true } : {}),
      };
      await updateContact(user.uid, editingContact, updated, dispatch);
    } else {
      const course = courseById.get(values.courseId);
      const newContact: Contact = {
        id: crypto.randomUUID(),
        courseId: values.courseId,
        ...(course && courseTermLabel(course, state.terms)
          ? { term: courseTermLabel(course, state.terms) }
          : {}),
        role: values.role,
        fullName: values.fullName.trim(),
        ...(values.title.trim() ? { title: values.title.trim() } : {}),
        ...(values.howToAddress.trim() ? { howToAddress: values.howToAddress.trim() } : {}),
        ...(values.email.trim() ? { email: values.email.trim() } : {}),
        ...(values.officeHours.trim() ? { officeHours: values.officeHours.trim() } : {}),
        ...(values.officeLocation.trim() ? { officeLocation: values.officeLocation.trim() } : {}),
        // Manually-added contacts start already approved - there's no AI
        // extraction to review here, the student typed it themselves.
        source: 'manual',
        approved: true,
      };
      await createContact(user.uid, newContact, dispatch);
    }
  };

  const handleDelete = async (contact: Contact) => {
    if (!user) return;
    try {
      await deleteContact(user.uid, contact, dispatch);
      setConfirmingDeleteId(null);
      showUndo('Contact deleted', `${contact.fullName} was removed.`, () =>
        createContact(user.uid, contact, dispatch),
      );
    } catch (err) {
      showError('Could not delete contact', err instanceof Error ? err.message : undefined);
    }
  };

  const handleScheduleVisit = async (contact: Contact, dateKey: string) => {
    if (!user) throw new Error('You must be signed in to schedule this.');
    const isClassmate = contact.role === 'classmate';
    try {
      await createScheduleItem(
        user.uid,
        {
          id: crypto.randomUUID(),
          courseId: contact.courseId,
          title: isClassmate
            ? `Study session with ${contact.howToAddress || contact.fullName}`
            : `Office hours — ${contact.howToAddress || contact.fullName}`,
          type: 'other',
          dueDate: new Date(`${dateKey}T23:59:00`).toISOString(),
          completed: false,
          source: 'manual',
          ...(contact.officeHours || contact.officeLocation
            ? {
                notes: [
                  contact.officeHours ? `Regular hours: ${contact.officeHours}` : '',
                  contact.officeLocation ? `Location: ${contact.officeLocation}` : '',
                ]
                  .filter(Boolean)
                  .join(' · '),
              }
            : {}),
        },
        dispatch,
      );
      showSuccess(
        isClassmate ? 'Study session scheduled' : 'Visit scheduled',
        `Added to your tasks for ${dateKey}.`,
      );
    } catch (err) {
      showError('Could not schedule this', err instanceof Error ? err.message : undefined);
      throw err;
    }
  };

  const selectClass =
    'rounded-lg border border-border bg-input px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary min-h-[44px]';

  return (
    <>
      <div className="max-w-5xl space-y-6 sm:space-y-8">
        <PageHeader
          eyebrow="You"
          title="Contacts"
          description={<>Professors and TAs across your courses, in one place.</>}
          actions={
            <>
              <CardActionButton variant="solid" withPlus onClick={openCreate}>
                Add Contact
              </CardActionButton>
            </>
          }
        />

        <div className="flex flex-wrap gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search contacts"
            placeholder="Search by name or course..."
            className="flex-1 min-w-[200px] rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary min-h-[44px]"
          />
          <select
            aria-label="Filter by term"
            value={effectiveTermFilter}
            onChange={(e) => setTermFilter(e.target.value)}
            className={cn(
              selectClass,
              // Emphasized (bordered, tinted) whenever narrowed to one term -
              // same treatment as CoursesListView's term select, so a filter
              // hiding contacts never reads as just a quiet dropdown.
              effectiveTermFilter !== 'all' &&
                'border-primary/50 bg-primary/5 font-semibold text-primary',
            )}
          >
            <option value="all">All Terms</option>
            {terms.map((term) => (
              <option key={term} value={term}>
                {term}
              </option>
            ))}
          </select>
        </div>

        {hiddenByTermCount > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 rounded-lg bg-primary/5 px-3 py-2 text-xs text-foreground min-h-[44px]">
            <span>
              Showing <span className="font-semibold">{effectiveTermFilter}</span> ·{' '}
              {hiddenByTermCount} more {hiddenByTermCount === 1 ? 'contact' : 'contacts'} in other
              terms.
            </span>
            <button
              type="button"
              onClick={() => setTermFilter('all')}
              className="inline-flex min-h-[44px] items-center px-1 font-semibold text-primary hover:underline"
            >
              View all terms
            </button>
          </div>
        )}

        {!state.initialized ? (
          // See the identical guard in CoursesListView.tsx.
          <div className="grid gap-3 sm:grid-cols-2">
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : personGroups.length === 0 ? (
          <Card className="rounded-2xl p-6">
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
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
              }
              title={contacts.length === 0 ? 'No contacts yet' : 'No contacts match these filters'}
              description={
                contacts.length === 0
                  ? 'Contacts show up automatically when you upload a syllabus, or add one manually.'
                  : 'Try a different search or term filter.'
              }
              action={
                contacts.length === 0 ? { label: '+ Add Contact', onClick: openCreate } : undefined
              }
            />
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {personGroups.map(({ primary, records }) => (
              <Card
                key={normalizeContactName(primary.fullName) || primary.id}
                className="rounded-2xl p-4"
              >
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-xs font-semibold',
                    primary.role === 'professor'
                      ? 'bg-primary/10 text-primary'
                      : 'bg-accent text-muted-foreground',
                  )}
                >
                  {ROLE_LABEL[primary.role]}
                </span>

                <div className="mt-3">
                  <div className="font-semibold text-foreground">{primary.fullName}</div>
                  {primary.title && (
                    <div className="text-xs text-muted-foreground">{primary.title}</div>
                  )}
                </div>

                <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                  {primary.howToAddress && <div>Address as: {primary.howToAddress}</div>}
                  {primary.email && (
                    <a
                      href={`mailto:${primary.email}`}
                      className="-my-3.5 flex min-h-11 items-center truncate text-primary hover:underline"
                    >
                      {primary.email}
                    </a>
                  )}
                </div>

                <div className="mt-5 space-y-3 border-t border-border pt-4">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {records.length === 1 ? 'Course' : 'Courses'}
                  </span>
                  <ul className="space-y-4">
                    {records.map((record) => (
                      <li key={record.id} className="text-xs">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <span className="font-medium text-foreground">
                            {courseLabel(courseById.get(record.courseId))}
                          </span>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-3 sm:justify-end">
                            {confirmingDeleteId === record.id ? (
                              <>
                                <RowActionButton
                                  tone="destructive"
                                  className="min-h-[44px] min-w-[44px]"
                                  onClick={() => handleDelete(record)}
                                >
                                  Confirm
                                </RowActionButton>
                                <button
                                  onClick={() => setConfirmingDeleteId(null)}
                                  className="inline-flex min-h-[44px] items-center justify-center rounded-full px-3 text-muted-foreground transition-colors hover:bg-accent"
                                >
                                  Cancel
                                </button>
                              </>
                            ) : (
                              <>
                                {(record.officeHours || record.role === 'classmate') && (
                                  <RowActionButton
                                    className="min-h-[44px] min-w-[44px]"
                                    aria-label={`${
                                      record.role === 'classmate'
                                        ? 'Schedule Study Session'
                                        : 'Schedule Visit'
                                    } with ${record.fullName}`}
                                    onClick={() => setSchedulingContact(record)}
                                  >
                                    {record.role === 'classmate'
                                      ? 'Schedule Study Session'
                                      : 'Schedule Visit'}
                                  </RowActionButton>
                                )}
                                <RowActionButton
                                  className="min-h-[44px] min-w-[44px]"
                                  aria-label={`Draft email to ${record.fullName}`}
                                  onClick={() => setDrafterContact(record)}
                                >
                                  Draft Email
                                </RowActionButton>
                                <RowActionButton
                                  className="min-h-[44px] min-w-[44px]"
                                  aria-label={`vCard/QR for ${record.fullName}`}
                                  onClick={() => setShareContact(record)}
                                >
                                  vCard/QR
                                </RowActionButton>
                                <RowActionButton
                                  className="min-h-[44px] min-w-[44px]"
                                  aria-label={`Edit ${record.fullName}`}
                                  onClick={() => openEdit(record)}
                                >
                                  Edit
                                </RowActionButton>
                                <RowActionButton
                                  tone="destructive"
                                  className="min-h-[44px] min-w-[44px]"
                                  aria-label={`Delete ${record.fullName}`}
                                  onClick={() => setConfirmingDeleteId(record.id)}
                                >
                                  Delete
                                </RowActionButton>
                              </>
                            )}
                          </div>
                        </div>
                        {(record.officeHours || record.officeLocation) && (
                          <div className="mt-3 text-muted-foreground">
                            {record.officeHours && <div>Office hours: {record.officeHours}</div>}
                            {record.officeLocation && <div>Office: {record.officeLocation}</div>}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <ContactFormModal
        open={formOpen}
        onClose={closeForm}
        onSubmit={handleSubmit}
        courses={courses}
        initialContact={editingContact}
      />
      {drafterContact && (
        <ProfessorEmailDrafterModal
          contact={drafterContact}
          onClose={() => setDrafterContact(null)}
        />
      )}
      {shareContact && (
        <ContactShareModal
          isOpen={!!shareContact}
          contact={shareContact}
          onClose={() => setShareContact(null)}
        />
      )}
      <ScheduleOfficeVisitModal
        contact={schedulingContact}
        onClose={() => setSchedulingContact(null)}
        onSchedule={handleScheduleVisit}
      />
    </>
  );
}

interface ContactFormModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: ContactFormValues) => Promise<void>;
  courses: Course[];
  initialContact?: Contact | null;
}

function ContactFormModal({
  open,
  onClose,
  onSubmit,
  courses,
  initialContact,
}: ContactFormModalProps) {
  const [values, setValues] = useState<ContactFormValues>(emptyFormValues(courses[0]?.id ?? ''));
  const [baseline, setBaseline] = useState<ContactFormValues>(
    emptyFormValues(courses[0]?.id ?? ''),
  );
  const [errors, setErrors] = useState<Partial<Record<keyof ContactFormValues, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const initial = initialContact
      ? {
          courseId: initialContact.courseId,
          role: initialContact.role,
          fullName: initialContact.fullName,
          title: initialContact.title ?? '',
          howToAddress: initialContact.howToAddress ?? '',
          email: initialContact.email ?? '',
          officeHours: initialContact.officeHours ?? '',
          officeLocation: initialContact.officeLocation ?? '',
        }
      : emptyFormValues(courses[0]?.id ?? '');
    setValues(initial);
    setBaseline(initial);
    setErrors({});
    setSubmitError(null);
  }, [open, initialContact, courses]);

  const { requestClose, confirmingDiscard, confirmDiscard, cancelDiscard } = useDirtyClose(
    values,
    baseline,
    onClose,
  );
  const dialogRef = useModalA11y<HTMLDivElement>(open, requestClose);

  if (!open) return null;

  const updateField = (key: keyof ContactFormValues, value: string) => {
    setValues((s) => ({ ...s, [key]: value }));
    setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    const fieldErrors: Partial<Record<keyof ContactFormValues, string>> =
      validateContactFields(values);
    if (!initialContact && !values.courseId) fieldErrors.courseId = 'Choose a course';
    if (Object.keys(fieldErrors).length) {
      setErrors(fieldErrors);
      return;
    }

    setErrors({});
    setSubmitError(null);
    setSubmitting(true);
    try {
      await onSubmit(values);
      onClose();
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'Failed to save contact. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    // The overlay scrolls and the dialog centres itself with auto margins, so a
    // dialog taller than the screen (a 768px laptop, a phone with the keyboard
    // up) can be scrolled to its save button instead of being clipped.
    <div
      className="fixed inset-0 z-[60] flex overflow-y-auto bg-black/40 px-4 py-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="contact-form-title"
      onClick={requestClose}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="relative m-auto w-full max-w-md outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <Card accent="none" opaque>
          {confirmingDiscard ? (
            <DiscardConfirmCard
              title="Discard unsaved changes?"
              description="You have changes to this contact that haven't been saved."
              onCancel={cancelDiscard}
              onConfirm={confirmDiscard}
            />
          ) : (
            <>
              <CardHeader>
                <CardTitle id="contact-form-title">
                  {initialContact ? 'Edit Contact' : 'Add Contact'}
                </CardTitle>
                <CardDescription>
                  {initialContact
                    ? 'Update this contact’s details.'
                    : 'Add a professor or TA to a course.'}
                </CardDescription>
              </CardHeader>
              <form onSubmit={handleSubmit}>
                <CardContent className="space-y-4">
                  {submitError && (
                    <div className="rounded-lg border border-load-critical/30 bg-load-critical/10 px-3 py-2 text-sm text-load-critical">
                      {submitError}
                    </div>
                  )}

                  {initialContact ? (
                    <div className="space-y-1.5">
                      <span className="text-sm font-medium text-foreground">Course</span>
                      <p className="text-sm text-muted-foreground">
                        {courseLabel(courses.find((c) => c.id === initialContact.courseId))}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <label
                        htmlFor="contact-course"
                        className="text-sm font-medium text-foreground"
                      >
                        Course
                      </label>
                      <select
                        id="contact-course"
                        value={values.courseId}
                        onChange={(e) => updateField('courseId', e.target.value)}
                        className={cn(
                          'w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary',
                          errors.courseId ? 'border-destructive' : 'border-border',
                        )}
                      >
                        <option value="">Select a course...</option>
                        {courses.map((course) => (
                          <option key={course.id} value={course.id}>
                            {courseLabel(course)}
                          </option>
                        ))}
                      </select>
                      {errors.courseId && (
                        <p className="text-xs text-destructive">{errors.courseId}</p>
                      )}
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <span className="text-sm font-medium text-foreground">Role</span>
                    <div className="flex gap-2">
                      {(['professor', 'ta', 'classmate'] as ContactRole[]).map((role) => (
                        <button
                          key={role}
                          type="button"
                          onClick={() => setValues((s) => ({ ...s, role }))}
                          className={cn(
                            'inline-flex min-h-[44px] items-center justify-center rounded-lg border px-4 py-2 text-xs font-medium transition-colors',
                            values.role === role
                              ? 'border-primary bg-primary/10 text-primary'
                              : 'border-border text-muted-foreground hover:bg-accent',
                          )}
                        >
                          {ROLE_LABEL[role]}
                        </button>
                      ))}
                    </div>
                  </div>

                  <Field
                    id="fullName"
                    label="Full Name"
                    value={values.fullName}
                    error={errors.fullName}
                    onChange={(v) => updateField('fullName', v)}
                    placeholder="Dr. Amara Chen"
                  />
                  <Field
                    id="title"
                    label="Title"
                    value={values.title}
                    error={errors.title}
                    onChange={(v) => updateField('title', v)}
                    placeholder="Associate Professor of Computer Science"
                  />
                  <Field
                    id="howToAddress"
                    label="Address As"
                    value={values.howToAddress}
                    error={errors.howToAddress}
                    onChange={(v) => updateField('howToAddress', v)}
                    placeholder="Dr. Chen"
                  />
                  <Field
                    id="email"
                    label="Email"
                    value={values.email}
                    error={errors.email}
                    onChange={(v) => updateField('email', v)}
                    placeholder="a.chen@university.edu"
                  />
                  <Field
                    id="officeHours"
                    label="Office Hours"
                    value={values.officeHours}
                    error={errors.officeHours}
                    onChange={(v) => updateField('officeHours', v)}
                    placeholder="Tue/Thu 2-3pm, or by appointment"
                  />
                  <Field
                    id="officeLocation"
                    label="Office Location"
                    value={values.officeLocation}
                    error={errors.officeLocation}
                    onChange={(v) => updateField('officeLocation', v)}
                    placeholder="Science Hall 214"
                  />
                </CardContent>
                <CardFooter className="justify-end gap-2">
                  <button
                    type="button"
                    onClick={requestClose}
                    className="inline-flex min-h-[44px] items-center justify-center rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    {submitting ? 'Saving...' : initialContact ? 'Save Changes' : 'Add Contact'}
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
