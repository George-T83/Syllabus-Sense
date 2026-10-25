import type { Contact, Course, ScheduleItem } from '@/types/schedule';

/** Everything "Try a sample semester" creates. Every record carries
 * `sample: true`. */
export interface SampleSemester {
  term: string;
  courses: Course[];
  scheduleItems: ScheduleItem[];
  contacts: Contact[];
}

/** The term label for a date: Spring (Jan-May), Summer (Jun-Jul), Fall
 * (Aug-Dec). */
export function termLabelFor(today: Date): string {
  const month = today.getMonth();
  const season = month <= 4 ? 'Spring' : month <= 6 ? 'Summer' : 'Fall';
  return `${season} ${today.getFullYear()}`;
}

/** Local 23:59 on the day `offset` days from `today`, as an ISO instant -
 * the same shape the task forms and the syllabus autofill save. */
function dueAt(today: Date, offset: number): string {
  return new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() + offset,
    23,
    59,
    0,
  ).toISOString();
}

interface ItemSpec {
  course: 0 | 1 | 2;
  title: string;
  type: ScheduleItem['type'];
  /** Days from today: negative is overdue, 0 is due today. */
  offset: number;
  hours?: number;
  weight?: number;
  category?: string;
  priority?: ScheduleItem['priority'];
  highStakes?: boolean;
  /** Already handed in, with this score back. */
  done?: number;
}

const ITEM_SPECS: ItemSpec[] = [
  // CSCI 120
  {
    course: 0,
    title: 'Lab 2: Variables and types',
    type: 'assignment',
    offset: -9,
    hours: 3,
    weight: 5,
    category: 'Labs',
    done: 88,
  },
  {
    course: 0,
    title: 'Lab 3: Loops and functions',
    type: 'assignment',
    offset: -2,
    hours: 3,
    weight: 5,
    category: 'Labs',
    priority: 'high',
  },
  {
    course: 0,
    title: 'Homework 4: Arrays',
    type: 'assignment',
    offset: 0,
    hours: 4,
    weight: 5,
    category: 'Homework',
    priority: 'high',
  },
  { course: 0, title: 'Reading: Chapter 6, Recursion', type: 'reading', offset: 2, hours: 2 },
  {
    course: 0,
    title: 'Quiz 2: Control flow',
    type: 'quiz',
    offset: 4,
    hours: 2,
    weight: 10,
    category: 'Quizzes',
  },
  {
    course: 0,
    title: 'Midterm exam',
    type: 'exam',
    offset: 8,
    hours: 10,
    weight: 25,
    category: 'Exams',
    priority: 'high',
    highStakes: true,
  },
  {
    course: 0,
    title: 'Final project: Text adventure game',
    type: 'project',
    offset: 30,
    hours: 20,
    weight: 20,
    category: 'Project',
  },
  // MATH 151
  {
    course: 1,
    title: 'Problem set 5: Derivative rules',
    type: 'assignment',
    offset: 1,
    hours: 3,
    weight: 5,
    category: 'Homework',
  },
  {
    course: 1,
    title: 'Reading: Section 3.4, The chain rule',
    type: 'reading',
    offset: 3,
    hours: 1.5,
  },
  {
    course: 1,
    title: 'Quiz 3: Derivatives',
    type: 'quiz',
    offset: 6,
    hours: 2,
    weight: 10,
    category: 'Quizzes',
  },
  {
    course: 1,
    title: 'Exam 1: Limits and derivatives',
    type: 'exam',
    offset: 12,
    hours: 12,
    weight: 30,
    category: 'Exams',
    priority: 'high',
    highStakes: true,
  },
  // PSYC 101
  { course: 2, title: 'Reading: Chapter 5, Memory', type: 'reading', offset: 1, hours: 1.5 },
  {
    course: 2,
    title: 'Response paper: Learning theories',
    type: 'assignment',
    offset: 5,
    hours: 3,
    weight: 10,
    category: 'Papers',
  },
  {
    course: 2,
    title: 'Quiz 2: Learning and memory',
    type: 'quiz',
    offset: 9,
    hours: 2,
    weight: 10,
    category: 'Quizzes',
  },
  {
    course: 2,
    title: 'Research project: Replicate a classic experiment',
    type: 'project',
    offset: 21,
    hours: 12,
    weight: 15,
    category: 'Project',
  },
  {
    course: 2,
    title: 'Midterm exam',
    type: 'exam',
    offset: 16,
    hours: 8,
    weight: 25,
    category: 'Exams',
    priority: 'high',
    highStakes: true,
  },
];

/**
 * Builds the sample semester for "Try a sample semester": three courses, 16
 * dated items and two contacts, with every due date relative to `today` so
 * the dashboard always has something real to show - one item overdue, one
 * due today, an exam inside ten days, weighted work throughout.
 *
 * Pure and deterministic: the same `today` and `existingTerms` always give
 * the same result, with fixed ids (so loading it twice rewrites the same
 * records instead of duplicating them). The sample lands in the student's
 * existing term when they have one, else the term `today` falls in.
 */
export function buildSampleSemester(today: Date, existingTerms: string[] = []): SampleSemester {
  const term = existingTerms.find((t) => t.trim().length > 0) ?? termLabelFor(today);

  const courses: Course[] = [
    {
      id: 'sample-course-1',
      code: 'CSCI 120',
      title: 'Introduction to Programming',
      instructor: 'Prof. Maya Okafor',
      color: 'bg-indigo-500',
      icon: 'code',
      term,
      credits: 4,
      modality: 'in-person',
      meetingTimes: [
        { dayOfWeek: 1, startTime: '10:00', endTime: '10:50', location: 'Engineering Hall 210' },
        { dayOfWeek: 3, startTime: '10:00', endTime: '10:50', location: 'Engineering Hall 210' },
        { dayOfWeek: 5, startTime: '10:00', endTime: '10:50', location: 'Engineering Hall 210' },
      ],
      source: 'manual',
      sample: true,
    },
    {
      id: 'sample-course-2',
      code: 'MATH 151',
      title: 'Calculus I',
      instructor: 'Dr. Daniel Reyes',
      color: 'bg-emerald-500',
      icon: 'calculator',
      term,
      credits: 4,
      modality: 'in-person',
      meetingTimes: [
        { dayOfWeek: 2, startTime: '09:30', endTime: '10:45', location: 'Science Building 105' },
        { dayOfWeek: 4, startTime: '09:30', endTime: '10:45', location: 'Science Building 105' },
      ],
      source: 'manual',
      sample: true,
    },
    {
      id: 'sample-course-3',
      code: 'PSYC 101',
      title: 'Introduction to Psychology',
      instructor: 'Prof. Hannah Lindqvist',
      color: 'bg-orange-500',
      icon: 'heart',
      term,
      credits: 3,
      modality: 'hybrid',
      meetingTimes: [
        { dayOfWeek: 1, startTime: '13:00', endTime: '14:15', location: 'Social Sciences 301' },
        { dayOfWeek: 3, startTime: '13:00', endTime: '14:15', location: 'Social Sciences 301' },
      ],
      source: 'manual',
      sample: true,
    },
  ];

  const scheduleItems: ScheduleItem[] = ITEM_SPECS.map((spec, i) => ({
    id: `sample-item-${String(i + 1).padStart(2, '0')}`,
    courseId: courses[spec.course].id,
    title: spec.title,
    type: spec.type,
    dueDate: dueAt(today, spec.offset),
    completed: spec.done !== undefined,
    priority: spec.priority ?? 'medium',
    source: 'manual',
    sample: true,
    ...(spec.hours !== undefined ? { estimatedHours: spec.hours } : {}),
    ...(spec.weight !== undefined ? { gradeWeight: spec.weight } : {}),
    ...(spec.category ? { gradeCategory: spec.category } : {}),
    ...(spec.highStakes ? { highStakes: true } : {}),
    ...(spec.done !== undefined ? { earnedScore: spec.done } : {}),
  }));

  const contacts: Contact[] = [
    {
      id: 'sample-contact-1',
      courseId: courses[0].id,
      term,
      role: 'professor',
      fullName: 'Maya Okafor',
      title: 'Associate Professor of Computer Science',
      howToAddress: 'Prof. Okafor',
      email: 'maya.okafor@example.edu',
      officeHours: 'Tue/Thu 2:00-3:30 PM',
      officeLocation: 'Engineering Hall 342',
      source: 'manual',
      approved: true,
      sample: true,
    },
    {
      id: 'sample-contact-2',
      courseId: courses[1].id,
      term,
      role: 'ta',
      fullName: 'Jordan Lee',
      title: 'Teaching Assistant',
      email: 'jordan.lee@example.edu',
      officeHours: 'Mon 4:00-5:30 PM, drop-in',
      officeLocation: 'Math Learning Center',
      source: 'manual',
      approved: true,
      sample: true,
    },
  ];

  return { term, courses, scheduleItems, contacts };
}

/** The minimal slice of app state the sample helpers read. */
export interface SampleScope {
  courses: Course[];
  scheduleItems: ScheduleItem[];
  contacts: Contact[];
}

/** Whether any course, task or contact is sample data. */
export function hasSampleData(scope: SampleScope): boolean {
  return (
    scope.courses.some((c) => c.sample) ||
    scope.scheduleItems.some((i) => i.sample) ||
    scope.contacts.some((c) => c.sample)
  );
}

/**
 * Every sample record, and nothing else: the `sample: true` courses, plus
 * the tasks and contacts that are flagged themselves or that belong to a
 * sample course (a course cannot be removed and leave its tasks behind).
 * The student's own courses, with their tasks and contacts, are never in here.
 */
export function collectSampleRecords(scope: SampleScope): SampleScope {
  const courses = scope.courses.filter((c) => c.sample);
  const courseIds = new Set(courses.map((c) => c.id));
  return {
    courses,
    scheduleItems: scope.scheduleItems.filter((i) => i.sample || courseIds.has(i.courseId)),
    contacts: scope.contacts.filter((c) => c.sample || courseIds.has(c.courseId)),
  };
}

/** The same lists without any sample record - what is safe to send to an AI
 * service or count in a figure the student is meant to own. */
export function withoutSample<T extends { sample?: boolean }>(records: T[]): T[] {
  return records.filter((r) => !r.sample);
}
