import type { CourseAiSummary } from '@/types/courseSummary';

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
  /** One of COURSE_ICON_PRESETS (lib/courseIcons.ts) - a subject glyph
   * shown alongside color, e.g. a flask for a science course. Missing or
   * unrecognized values resolve to the default via resolveCourseIcon(). */
  icon?: string;
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
  /** General required/optional materials from the syllabus (textbook,
   * calculator, supplies) that aren't tied to a specific due date. */
  materials?: string[];
  /** ISO dates (YYYY-MM-DD) on which recurring meetings should NOT render -
   * holidays and breaks called out in the syllabus (e.g. "1/19 - HOLIDAY").
   * Only suppresses `meetingTimes` occurrences; never affects `ScheduleItem`
   * due dates, since a real deadline shouldn't disappear on a break. */
  skipDates?: string[];
  /** AI-generated plain-English summary + "important notes" from the most
   * recently summarized syllabus upload. Cached here rather than
   * regenerated on every view - see src/app/api/syllabus/summarize. */
  aiSummary?: CourseAiSummary;
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
  /** Completion status of the task - the sole authoritative "done" signal.
   * `progress` below is a separate, softer measure and never overrides this. */
  completed: boolean;
  /** Self-reported completion progress, 0-100. Undefined or 0 means not
   * started; a value above 0 (while `completed` is still false) means in
   * progress. Feeds the workload engine's remaining-hours estimate (see
   * getBaseEffectiveHours in lib/workload/dailyLoad.ts) so a half-finished
   * project counts as half its estimated hours instead of its full estimate
   * right up until the moment it's checked done. See lib/taskStatus.ts for
   * the derived not_started/in_progress/completed status every surface uses. */
  progress?: number;
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
  /** How confident the AI extractor was in `dueDate`, when `source` is 'ai'.
   * 'approximate' means the syllabus only gave a week/range and the date was
   * resolved (e.g. via a stated "all due Fridays" rule or the range's last
   * day) rather than stated explicitly - surfaced as a "please confirm"
   * badge. Absent for manually-entered items, which are always exact. */
  dateConfidence?: 'exact' | 'approximate';
  /** Set when the AI extractor judged this item unusually high-stakes (large
   * grade weight, or explicit "mandatory"/"automatic F if missed" language)
   * so it can be visually flagged during review instead of blending in with
   * routine items. */
  highStakes?: boolean;
}

/**
 * Union representing the student's workload level.
 * Maps to existing Tailwind tokens: load-low, load-medium, load-high, load-critical.
 */
export type WorkloadLevel = 'low' | 'medium' | 'high' | 'critical';
