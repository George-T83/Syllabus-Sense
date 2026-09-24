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
 * A required/optional course material (textbook, calculator, supplies),
 * with an optional cost so a semester's spending can be totaled up.
 */
export interface MaterialItem {
  name: string;
  /** Price in whole currency units (e.g. 89.99), not cents. */
  cost?: number;
}

/** A single logged absence for AttendanceGauge's per-course tracker. */
export interface AbsenceRecord {
  id: string;
  /** ISO date (YYYY-MM-DD) */
  date: string;
  type: 'excused' | 'unexcused';
  reason?: string;
  note?: string;
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
   * calculator, supplies) that aren't tied to a specific due date. Older
   * records may still hold plain strings from before the `cost` field
   * existed - always read through normalizeMaterials() (lib/courses/
   * materials.ts) rather than assuming every entry is a MaterialItem. */
  materials?: MaterialItem[];
  /** ISO dates (YYYY-MM-DD) on which recurring meetings should NOT render -
   * holidays and breaks called out in the syllabus (e.g. "1/19 - HOLIDAY").
   * Only suppresses `meetingTimes` occurrences; never affects `ScheduleItem`
   * due dates, since a real deadline shouldn't disappear on a break. */
  skipDates?: string[];
  /** AI-generated plain-English summary + "important notes" from the most
   * recently summarized syllabus upload. Cached here rather than
   * regenerated on every view - see src/app/api/syllabus/summarize. */
  aiSummary?: CourseAiSummary;
  /** Detailed, bulleted learning objectives extracted from the syllabus
   * (or written manually) - each string is one bullet, may itself contain
   * markdown emphasis (e.g. "**Analyze** primary sources for bias"). */
  learningObjectives?: string[];
  /** Whether the student has reviewed/approved `learningObjectives` after
   * an AI extraction - mirrors the review step every other AI-sourced
   * field goes through, so objectives are never silently trusted. */
  learningObjectivesApproved?: boolean;
  /** Manually-logged absences for the attendance tracker (AttendanceGauge). */
  absences?: AbsenceRecord[];
}

/** Whether a contact is the instructor of record or a teaching assistant. */
export type ContactRole = 'professor' | 'ta' | 'classmate';

/**
 * A course-affiliated professor or TA, usually populated from syllabus
 * extraction (Contacts feature). Scoped to one course/term rather than a
 * global address book, since office hours/location are course-specific and
 * the same person's info can legitimately differ semester to semester.
 */
export interface Contact {
  /** Unique identifier for the contact */
  id: string;
  /** The course this contact is affiliated with */
  courseId: string;
  /** The academic term, mirrors the parent course's term at creation time
   * so Contacts can be filtered by term the same way Courses is, without
   * a join back to the course on every render. */
  term?: string;
  role: ContactRole;
  fullName: string;
  /** e.g. "Associate Professor of Computer Science" */
  title?: string;
  /** How the syllabus says to address them, e.g. "Dr. Chen" or "Professor
   * Lee" - distinct from `fullName` since it's a social/etiquette detail,
   * not identity. */
  howToAddress?: string;
  email?: string;
  /** Free text rather than structured MeetingTime[] - office hours are
   * stated too inconsistently across real syllabi ("by appointment",
   * "drop-in Tue/Thu", a specific range) to force into one shape. */
  officeHours?: string;
  officeLocation?: string;
  /** Whether this record originated from AI syllabus extraction or was
   * entered/edited by hand. */
  source?: DataSource;
  /** Whether the student has reviewed and approved this contact as a
   * whole - AI-sourced contacts start false so a student always sees a
   * chance to correct or reject before it's treated as final. */
  approved?: boolean;
  /** Per-field approval, for AI extractions the student partially trusts -
   * e.g. approving the name and email but flagging office hours as wrong.
   * A field absent from this map is treated as approved (true is the
   * implicit default so a fully-approved contact doesn't need every key
   * listed). */
  fieldApprovals?: Partial<
    Record<
      'fullName' | 'title' | 'howToAddress' | 'email' | 'officeHours' | 'officeLocation',
      boolean
    >
  >;
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
  /** The score actually received on this item, as a percentage (0-100+,
   * so extra credit isn't clipped). Distinct from `gradeWeight` - weight is
   * planned before the fact, this is entered once the grade comes back.
   * Only meaningful alongside `gradeWeight`; an item with a score but no
   * weight has nothing for the grade calculator to weight it by. */
  earnedScore?: number;
  /** Free-text name of who owns this sub-task on a group project - a
   * private label only the signed-in user sees, not a shared assignment
   * system. Lets a chunked group project ("Literature review", "Data
   * collection", ...) show who's doing what without any new sharing
   * infrastructure. */
  assignedTo?: string;
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
