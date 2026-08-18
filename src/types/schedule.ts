/**
 * How a course's class sessions are held.
 */
export type CourseModality = 'in-person' | 'online' | 'hybrid';

/**
 * A single recurring weekly class meeting (#118). `dayOfWeek` is 0=Sunday
 * through 6=Saturday, matching `Date.getDay()` / the calendar grid's own
 * Sunday-first week so no conversion is needed when rendering.
 */
export interface MeetingTime {
  dayOfWeek: number;
  /** 24-hour "HH:mm", e.g. "09:00" */
  startTime: string;
  /** 24-hour "HH:mm", e.g. "10:15" */
  endTime: string;
  location?: string;
}

/**
 * Represents a student's course.
 */
export interface Course {
  /** Unique identifier for the course */
  id: string;
  /** The course code, e.g., 'CSCI 213' */
  code: string;
  /** The full title of the course, e.g., 'Computer Science I' */
  title: string;
  /** The name of the instructor teaching the course */
  instructor?: string;
  /** HEX or Tailwind class for color coding this course in UI elements */
  color?: string;
  /** The academic term, e.g., 'Fall 2026' */
  term?: string;
  /** Free-text notes about the course */
  notes?: string;
  /** Whether this course was entered manually or created from AI syllabus extraction. Defaults to 'manual' when absent. */
  source?: DataSource;
  /** How class sessions are held */
  modality?: CourseModality;
  /** Recurring weekly meeting times, e.g. "MWF 9:00-10:15" */
  meetingTimes?: MeetingTime[];
}

/**
 * Union representing different types of coursework or schedule items.
 */
export type AssignmentType = 'assignment' | 'exam' | 'quiz' | 'project' | 'reading' | 'other';

/**
 * Priority level a user can assign to a schedule item.
 */
export type Priority = 'low' | 'medium' | 'high';

/**
 * Whether a record originated from manual user entry or AI syllabus extraction.
 */
export type DataSource = 'manual' | 'ai';

/**
 * Represents a dated piece of work/task associated with a course.
 */
export interface ScheduleItem {
  /** Unique identifier for the schedule item */
  id: string;
  /** The ID of the course this item belongs to */
  courseId: string;
  /** Title or description of the task */
  title: string;
  /** The type of coursework/schedule item */
  type: AssignmentType;
  /** The due date represented as an ISO date string (YYYY-MM-DD or full ISO-8601 string) for easy serialization */
  dueDate: string;
  /** Estimated hours required to complete this task */
  estimatedHours?: number;
  /** Completion status of the task */
  completed: boolean;
  /** User-assigned priority */
  priority?: Priority;
  /** Free-text notes */
  notes?: string;
  /** Weight of this item toward the course's final grade, as a percentage (e.g. 15 for 15%) */
  gradeWeight?: number;
  /** Grading category this item falls under, e.g. 'Homework', 'Exam' */
  gradeCategory?: string;
  /** Whether this item was entered manually or created from AI syllabus extraction. Defaults to 'manual' when absent. */
  source?: DataSource;
}

/**
 * Union representing the student's workload level.
 * Maps to existing Tailwind tokens: load-low, load-medium, load-high, load-critical.
 */
export type WorkloadLevel = 'low' | 'medium' | 'high' | 'critical';
