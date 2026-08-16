const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

export function validateSyllabusFile(file: File): FileValidationResult {
  if (file.type !== 'application/pdf') {
    return { valid: false, error: 'Only PDF files are supported.' };
  }
  if (file.size > MAX_SIZE_BYTES) {
    return { valid: false, error: 'File is too large (max 10MB).' };
  }
  return { valid: true };
}
