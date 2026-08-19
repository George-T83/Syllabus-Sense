const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

const ACCEPTED_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

export function validateSyllabusFile(file: File): FileValidationResult {
  // Browsers don't always fill in `file.type` correctly (some send '' for
  // .docx depending on OS file-association state), so an unrecognized name
  // extension is also accepted here - the server re-checks real magic bytes
  // regardless, so this is just a fast client-side hint, not the real gate.
  const hasAcceptedExtension = /\.(pdf|docx)$/i.test(file.name);
  if (!ACCEPTED_TYPES.has(file.type) && !hasAcceptedExtension) {
    return { valid: false, error: 'Only PDF or Word (.docx) files are supported.' };
  }
  if (file.size > MAX_SIZE_BYTES) {
    return { valid: false, error: 'File is too large (max 10MB).' };
  }
  return { valid: true };
}
