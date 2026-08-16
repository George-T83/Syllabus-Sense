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
}
