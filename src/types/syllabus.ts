/**
 * Metadata record for a syllabus PDF uploaded to Firebase Storage.
 */
export interface SyllabusUpload {
  id: string;
  courseId: string;
  fileName: string;
  storagePath: string;
  downloadURL: string;
  sizeBytes: number;
  uploadedAt: string;
  /** Whether this is the version currently treated as authoritative for the
   * course - the one recent uploads get diffed against, and the one shown
   * as "current" when a course has several. Exactly one upload per course
   * should have this true; a course whose uploads predate this field (none
   * of them set) falls back to treating the most recent one as primary. */
  isPrimary?: boolean;
}
