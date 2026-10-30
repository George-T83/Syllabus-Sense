/**
 * An academic term the student has defined: a label and the first and last
 * day it runs. Courses point at one by `termId`. Stored at
 * `users/{uid}/terms/{id}`.
 */
export interface Term {
  id: string;
  /** What the student calls it, e.g. "Fall 2026". */
  label: string;
  /** First day, `YYYY-MM-DD`. */
  startDate: string;
  /** Last day, `YYYY-MM-DD`. */
  endDate: string;
}
