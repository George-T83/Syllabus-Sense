'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { CardActionButton } from '@/components/ui/CardAction';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { resolveActiveTerm, useAppState } from '@/context/AppStateContext';
import { useAuth } from '@/context/AuthContext';
import { createCourse } from '@/lib/firestore/courses';
import { CourseFormModal } from '@/components/courses/CourseFormModal';
import { SyllabusAutofillModal } from '@/components/syllabus/SyllabusAutofillModal';
import type { CourseFormValues } from '@/lib/validation/course';
import { courseSwatch, courseWash } from '@/lib/courseColors';
import { cn } from '@/lib/utils';

import { useEffect } from 'react';
import { GradeCalculatorModal } from '@/components/courses/GradeCalculatorModal';

type SortMode = 'code' | 'title' | 'term';

const WEEKDAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function meetingDaysLabel(meetingTimes: { dayOfWeek: number }[] | undefined): string | null {
  if (!meetingTimes?.length) return null;
  const days = Array.from(new Set(meetingTimes.map((m) => m.dayOfWeek))).sort((a, b) => a - b);
  return days.map((d) => WEEKDAY_ABBR[d]).join('/');
}

export function CoursesListView() {
  const { state, dispatch } = useAppState();
  const { user } = useAuth();
  const { courses, scheduleItems } = state;

  const [search, setSearch] = useState('');
  const [termFilter, setTermFilter] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>('code');
  const [addCourseOpen, setAddCourseOpen] = useState(false);
  const [autofillOpen, setAutofillOpen] = useState(false);
  const [simulatorOpen, setSimulatorOpen] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (
        window.location.search.includes('simulator=true') ||
        window.location.search.includes('grade=true')
      ) {
        setSimulatorOpen(true);
      }
      // CommandPalette's "Add New Course" / "Upload Syllabus" actions - both
      // previously navigated here with no query param this page read, so
      // the user just landed on the plain list with no modal opening.
      if (window.location.search.includes('new=1')) {
        setAddCourseOpen(true);
      }
      if (window.location.search.includes('autofill=true')) {
        setAutofillOpen(true);
      }
    }
  }, []);

  const terms = useMemo(
    () => Array.from(new Set(courses.map((c) => c.term).filter(Boolean))) as string[],
    [courses],
  );

  const activeTerm = useMemo(
    () => resolveActiveTerm(state.selectedTerm, courses),
    [state.selectedTerm, courses],
  );
  const effectiveTermFilter = termFilter ?? activeTerm ?? 'all';
  const hiddenByTermCount =
    effectiveTermFilter !== 'all'
      ? courses.filter((c) => c.term !== effectiveTermFilter).length
      : 0;

  const filteredCourses = useMemo(() => {
    let result = courses.slice();

    if (effectiveTermFilter !== 'all')
      result = result.filter((c) => c.term === effectiveTermFilter);

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        (c) =>
          c.code.toLowerCase().includes(q) ||
          c.title.toLowerCase().includes(q) ||
          c.instructor?.toLowerCase().includes(q),
      );
    }

    result.sort((a, b) => {
      if (sortMode === 'title') return a.title.localeCompare(b.title);
      if (sortMode === 'term') return (a.term ?? '').localeCompare(b.term ?? '');
      return a.code.localeCompare(b.code);
    });

    return result;
  }, [courses, search, effectiveTermFilter, sortMode]);

  const handleAddCourse = async (values: CourseFormValues) => {
    if (!user) throw new Error('You must be signed in to add a course.');
    await createCourse(
      user.uid,
      {
        id: crypto.randomUUID(),
        code: values.code,
        title: values.title,
        color: values.color,
        icon: values.icon,
        ...(values.instructor ? { instructor: values.instructor } : {}),
        ...(values.term ? { term: values.term } : {}),
        ...(values.modality ? { modality: values.modality } : {}),
        ...(values.meetingTimes?.length ? { meetingTimes: values.meetingTimes } : {}),
        ...(values.skipDates?.length ? { skipDates: values.skipDates } : {}),
      },
      dispatch,
    );
  };

  const selectClass =
    'rounded-lg border border-border bg-input px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary';

  return (
    <>
      <div className="max-w-5xl space-y-6 sm:space-y-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Courses</h1>
            <p className="text-sm text-muted-foreground mt-1">
              See what needs attention across every class.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <CardActionButton onClick={() => setAutofillOpen(true)}>
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
                  d="M9 13h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              Autofill from Syllabus
            </CardActionButton>
            <CardActionButton variant="solid" withPlus onClick={() => setAddCourseOpen(true)}>
              Add Course
            </CardActionButton>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by code, title, or instructor..."
            className="flex-1 min-w-[200px] rounded-lg border border-border bg-input px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <select
            value={effectiveTermFilter}
            onChange={(e) => setTermFilter(e.target.value)}
            className={cn(
              selectClass,
              // Emphasized (bordered, tinted) whenever narrowed to one term,
              // so a filter that's hiding courses is never just a quiet
              // dropdown - it visibly looks "on."
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
          <select
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as SortMode)}
            className={selectClass}
          >
            <option value="code">Sort: Code</option>
            <option value="title">Sort: Title</option>
            <option value="term">Sort: Term</option>
          </select>
        </div>

        {/* CO-2: names the active filter out loud and says exactly how many
            courses it's hiding, so an older course never just silently
            disappears - one click switches to All Terms. */}
        {hiddenByTermCount > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 rounded-lg bg-primary/5 px-3 py-2 text-xs text-foreground">
            <span>
              Showing <span className="font-semibold">{effectiveTermFilter}</span> ·{' '}
              {hiddenByTermCount} more {hiddenByTermCount === 1 ? 'course' : 'courses'} in other
              terms.
            </span>
            <button
              type="button"
              onClick={() => setTermFilter('all')}
              className="font-semibold text-primary hover:underline"
            >
              View all terms
            </button>
          </div>
        )}

        {!state.initialized ? (
          // The Firestore listener's first snapshot hasn't landed yet -
          // courses defaults to [] the same as "genuinely has none", so
          // without this branch a student with real courses briefly sees
          // "No courses yet" (and a working "+ Add Course" button) for
          // however long the network takes, not just an instant.
          <div className="grid gap-3 sm:grid-cols-2">
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : filteredCourses.length === 0 ? (
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
                    d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                  />
                </svg>
              }
              title={courses.length === 0 ? 'No courses yet' : 'No courses match these filters'}
              description={
                courses.length === 0
                  ? 'Add one to get started.'
                  : 'Try a different search or term filter.'
              }
              action={
                courses.length === 0
                  ? { label: '+ Add Course', onClick: () => setAddCourseOpen(true) }
                  : undefined
              }
            />
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {filteredCourses.map((course) => {
              const items = scheduleItems.filter((i) => i.courseId === course.id);
              const completed = items.filter((i) => i.completed).length;
              const pct = items.length ? Math.round((completed / items.length) * 100) : 0;
              const meetingDays = meetingDaysLabel(course.meetingTimes);
              // Same "overdue" definition CourseDetailView already uses for
              // its per-task badge (CO-1) - surfaced here too so the list a
              // student opens to decide what to worry about actually answers
              // that, instead of only a generic completion percentage.
              const now = new Date();
              const overdueCount = items.filter(
                (i) => !i.completed && new Date(i.dueDate) < now,
              ).length;

              return (
                <Link key={course.id} href={`/courses/${course.id}`} className="block">
                  <Card hoverable className="flex h-full flex-col overflow-hidden rounded-2xl p-0">
                    <div
                      className={cn('h-2 w-full', courseSwatch(course.color).className)}
                      style={courseSwatch(course.color).style}
                    />
                    <div className="flex flex-1 flex-col p-5" style={courseWash(course.color)}>
                      <div className="mb-2 flex items-center gap-3">
                        <span
                          className={cn(
                            'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-base font-bold text-white shadow-sm',
                            courseSwatch(course.color).className,
                          )}
                          style={courseSwatch(course.color).style}
                        >
                          {course.code.slice(0, 1)}
                        </span>
                        <div className="min-w-0">
                          <div className="font-semibold text-foreground truncate">
                            {course.code}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {course.title}
                          </div>
                        </div>
                      </div>

                      <div className="mb-3 flex flex-wrap items-center gap-1.5">
                        {/* Term badge lives on every card (not just the bottom-line
                            caption it replaces) so a course keeps a clear identity
                            even once the list defaults to showing every term at
                            once (CO-2). */}
                        <span
                          className={cn(
                            'rounded-full px-2 py-0.5 text-[10px] font-medium',
                            course.term
                              ? 'bg-accent text-muted-foreground'
                              : 'bg-accent/60 italic text-muted-foreground/70',
                          )}
                        >
                          {course.term || 'No term set'}
                        </span>
                        {meetingDays && (
                          <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                            {meetingDays}
                          </span>
                        )}
                        {course.modality && (
                          <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-medium capitalize text-muted-foreground">
                            {course.modality}
                          </span>
                        )}
                        {overdueCount > 0 && (
                          <span className="ml-auto rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive">
                            {overdueCount} overdue
                          </span>
                        )}
                      </div>

                      <div className="mt-auto space-y-1.5">
                        <div className="flex items-center justify-end text-xs text-muted-foreground">
                          <span>
                            {items.length > 0
                              ? `${pct}% · ${items.length} task${items.length === 1 ? '' : 's'}`
                              : 'No tasks yet'}
                          </span>
                        </div>
                        {items.length > 0 && (
                          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                            <div
                              className={cn(
                                'h-full rounded-full',
                                courseSwatch(course.color).className,
                              )}
                              style={{ width: `${pct}%`, ...courseSwatch(course.color).style }}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <CourseFormModal
        open={addCourseOpen}
        onClose={() => setAddCourseOpen(false)}
        onSubmit={handleAddCourse}
      />
      <SyllabusAutofillModal open={autofillOpen} onClose={() => setAutofillOpen(false)} />
      <GradeCalculatorModal isOpen={simulatorOpen} onClose={() => setSimulatorOpen(false)} />
    </>
  );
}
