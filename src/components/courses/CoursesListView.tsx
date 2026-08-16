'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { useAppState } from '@/context/AppStateContext';
import { useAuth } from '@/context/AuthContext';
import { createCourse } from '@/lib/firestore/courses';
import { CourseFormModal } from '@/components/courses/CourseFormModal';
import type { CourseFormValues } from '@/lib/validation/course';

type SortMode = 'code' | 'title' | 'term';

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
          <p className="text-sm text-muted-foreground">
            {courses.length === 0
              ? 'No courses yet. Add one to get started.'
              : 'No courses match these filters.'}
          </p>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filteredCourses.map((course) => {
            const items = scheduleItems.filter((i) => i.courseId === course.id);
            const completed = items.filter((i) => i.completed).length;
            const pct = items.length ? Math.round((completed / items.length) * 100) : 0;

            return (
              <Link key={course.id} href={`/courses/${course.id}`}>
                <Card hoverable className="rounded-2xl p-5 h-full">
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className={`h-2.5 w-2.5 rounded-full shrink-0 ${course.color || 'bg-primary'}`}
                    />
                    <span className="font-semibold text-foreground truncate">{course.code}</span>
                  </div>
                  <div className="text-sm text-muted-foreground truncate mb-3">{course.title}</div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{course.term || 'No term set'}</span>
                    <span>
                      {items.length > 0
                        ? `${pct}% · ${items.length} task${items.length === 1 ? '' : 's'}`
                        : 'No tasks yet'}
                    </span>
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
