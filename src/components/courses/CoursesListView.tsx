'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { useAppState } from '@/context/AppStateContext';
import { useAuth } from '@/context/AuthContext';
import { createCourse } from '@/lib/firestore/courses';
import { CourseFormModal } from '@/components/courses/CourseFormModal';
import type { CourseFormValues } from '@/lib/validation/course';
import { cn } from '@/lib/utils';

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
  const [termFilter, setTermFilter] = useState('all');
  const [sortMode, setSortMode] = useState<SortMode>('code');
  const [addCourseOpen, setAddCourseOpen] = useState(false);

  const terms = useMemo(
    () => Array.from(new Set(courses.map((c) => c.term).filter(Boolean))) as string[],
    [courses],
  );

  const filteredCourses = useMemo(() => {
    let result = courses.slice();

    if (termFilter !== 'all') result = result.filter((c) => c.term === termFilter);

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
  }, [courses, search, termFilter, sortMode]);

  const handleAddCourse = async (values: CourseFormValues) => {
    if (!user) throw new Error('You must be signed in to add a course.');
    await createCourse(
      user.uid,
      {
        id: crypto.randomUUID(),
        code: values.code,
        title: values.title,
        color: values.color,
        ...(values.instructor ? { instructor: values.instructor } : {}),
        ...(values.term ? { term: values.term } : {}),
        ...(values.modality ? { modality: values.modality } : {}),
        ...(values.meetingTimes?.length ? { meetingTimes: values.meetingTimes } : {}),
      },
      dispatch,
    );
  };

  const selectClass =
    'rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary';

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Courses</h1>
          <p className="text-sm text-muted-foreground mt-1">Every course you&apos;re tracking.</p>
        </div>
        <button
          onClick={() => setAddCourseOpen(true)}
          className="text-sm font-semibold text-primary hover:underline shrink-0"
        >
          + Add Course
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by code, title, or instructor..."
          className="flex-1 min-w-[200px] rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <select
          value={termFilter}
          onChange={(e) => setTermFilter(e.target.value)}
          className={selectClass}
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

      {filteredCourses.length === 0 ? (
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

            return (
              <Link key={course.id} href={`/courses/${course.id}`} className="block">
                <Card hoverable className="flex h-full flex-col overflow-hidden rounded-2xl p-0">
                  <div className={cn('h-1.5 w-full', course.color || 'bg-primary')} />
                  <div className="flex flex-1 flex-col p-5">
                    <div className="mb-2 flex items-center gap-3">
                      <span
                        className={cn(
                          'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white',
                          course.color || 'bg-primary',
                        )}
                      >
                        {course.code.slice(0, 1)}
                      </span>
                      <div className="min-w-0">
                        <div className="font-semibold text-foreground truncate">{course.code}</div>
                        <div className="text-xs text-muted-foreground truncate">{course.title}</div>
                      </div>
                    </div>

                    {(meetingDays || course.modality) && (
                      <div className="mb-3 flex flex-wrap gap-1.5">
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
                      </div>
                    )}

                    <div className="mt-auto space-y-1.5">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{course.term || 'No term set'}</span>
                        <span>
                          {items.length > 0
                            ? `${pct}% · ${items.length} task${items.length === 1 ? '' : 's'}`
                            : 'No tasks yet'}
                        </span>
                      </div>
                      {items.length > 0 && (
                        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                          <div
                            className={cn('h-full rounded-full', course.color || 'bg-primary')}
                            style={{ width: `${pct}%` }}
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

      <CourseFormModal
        open={addCourseOpen}
        onClose={() => setAddCourseOpen(false)}
        onSubmit={handleAddCourse}
      />
    </div>
  );
}
