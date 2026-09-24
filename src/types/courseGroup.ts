/**
 * Section Sync (Section-Mate Deadline Confirmation)
 *
 * The one deliberately cross-user surface in this app. Everything else lives
 * under a private `users/{uid}` tree that no other account can ever read -
 * see firestore.rules. A course group is the opposite: a small, invite-code-
 * gated shared record outside that tree, holding only the minimum needed to
 * let classmates confirm what due date they each have for the same
 * assignment. No task content, no grades, no syllabus data ever crosses this
 * boundary - just a name, a date, and who's confirmed it.
 *
 * Joining is opt-in and always by invite code (never automatic matching by
 * course code/term) - there's no institution field anywhere in this app's
 * data model, so matching purely on a free-text course code could otherwise
 * link students at two entirely different schools who happen to both have a
 * "CS 301."
 */

/** The shared group record itself. Its Firestore document ID *is* the invite
 * code (see src/lib/courseGroups/inviteCode.ts) - joining is a direct read
 * by ID, so no server-side lookup function is needed for something this app
 * has none of otherwise. */
export interface CourseGroup {
  code: string;
  /** Free text the creator chose to label the group, e.g. "CS 301 - Prof
   * Lovelace - Fall 2026" - shown to anyone previewing the invite code
   * before they join, purely descriptive and never used for matching. */
  courseLabel: string;
  createdBy: string;
  createdAt: string;
}

/** One member's presence in a group - membership is exactly what gates read
 * access to the group's checkpoints/confirmations (see firestore.rules). */
export interface CourseGroupMember {
  uid: string;
  /** What this member is shown as to the rest of the group - either their
   * real display name or the same email-prefix pseudonym already used
   * elsewhere in the app (Navbar's `displayName || email.split('@')[0]`
   * fallback), per their own `showRealName` choice. */
  displayName: string;
  showRealName: boolean;
  joinedAt: string;
}

/** A named "thing we're all tracking a date for" - a member creates one for
 * an assignment/exam they want section-mates to confirm, deliberately just a
 * label rather than a link to any private task record. */
export interface CourseGroupCheckpoint {
  id: string;
  label: string;
  createdBy: string;
  createdAt: string;
}

/** One member's confirmed date for one checkpoint. Document ID is
 * `${checkpointId}_${uid}` for natural uniqueness (one confirmation per
 * member per checkpoint), though the security rule authorizes off the
 * `uid` field itself, not the ID string. */
export interface CheckpointConfirmation {
  id: string;
  checkpointId: string;
  uid: string;
  displayName: string;
  /** ISO date (YYYY-MM-DD) - just the date signal, never a time or any
   * other assignment detail. */
  date: string;
  confirmedAt: string;
}
