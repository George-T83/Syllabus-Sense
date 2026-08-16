import { Course, ScheduleItem } from '@/types/schedule';

/**
 * TEMPORARY PLACEHOLDER MOCK DATA
 * Note: This file contains temporary data to be replaced once the
 * Firebase/Firestore integration lands in later phases of the project.
 * It is exported to be opted into for testing, development, and seeding,
 * rather than being auto-seeded by default to avoid shipping fake data.
 */

export const mockCourses: Course[] = [
  {
    id: 'course-1',
    code: 'CSCI 213',
    title: 'Computer Science I',
    instructor: 'Dr. Ada Lovelace',
    color: 'bg-blue-500',
    term: 'Fall 2026',
  },
  {
    id: 'course-2',
    code: 'MATH 301',
    title: 'Linear Algebra',
    instructor: 'Prof. Alan Turing',
    color: 'bg-green-500',
    term: 'Fall 2026',
  },
  {
    id: 'course-3',
    code: 'LIT 101',
    title: 'Introduction to Literature',
    instructor: 'Mary Shelley',
    color: 'bg-purple-500',
    term: 'Fall 2026',
  },
];

export const mockScheduleItems: ScheduleItem[] = [
  {
    id: 'item-1',
    courseId: 'course-1',
    title: 'Programming Assignment 1: Recursion',
    type: 'assignment',
    dueDate: '2026-09-01T23:59:59.000Z',
    estimatedHours: 5,
    completed: false,
  },
  {
    id: 'item-2',
    courseId: 'course-1',
    title: 'Midterm Exam',
    type: 'exam',
    dueDate: '2026-10-15T14:00:00.000Z',
    estimatedHours: 10,
    completed: false,
  },
  {
    id: 'item-3',
    courseId: 'course-2',
    title: 'Matrix Operations Quiz',
    type: 'quiz',
    dueDate: '2026-09-05T10:30:00.000Z',
    estimatedHours: 2,
    completed: true,
  },
  {
    id: 'item-4',
    courseId: 'course-2',
    title: 'Vector Spaces Problem Set',
    type: 'assignment',
    dueDate: '2026-09-12T23:59:59.000Z',
    estimatedHours: 4,
    completed: false,
  },
  {
    id: 'item-5',
    courseId: 'course-3',
    title: 'Read Frankenstein Chapters 1-5',
    type: 'reading',
    dueDate: '2026-08-25T08:00:00.000Z',
    estimatedHours: 3,
    completed: false,
  },
  {
    id: 'item-6',
    courseId: 'course-3',
    title: 'Term Paper Proposal',
    type: 'project',
    dueDate: '2026-09-30T23:59:59.000Z',
    estimatedHours: 6,
    completed: false,
  },
];
