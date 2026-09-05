/**
 * Server-only: plain, non-AI text extraction from an uploaded syllabus file.
 * Used to get a comparable text version of a document for the version-diff
 * feature, without spending an Anthropic call - that's reserved for the full
 * structured extraction in `/api/syllabus/extract`.
 */
import { Buffer } from 'node:buffer';

export type SyllabusFileKind = 'pdf' | 'docx';

/**
 * Detected from magic bytes, not the client-declared MIME type (spoofable)
 * or file extension. Both prefixes are stable regardless of what follows -
 * base64 encodes in fixed 3-byte groups, so a known byte run at the start
 * of a file always produces the same leading base64 characters.
 * PDF: "%PDF-" (0x25 0x50 0x44 0x46 0x2D). DOCX: a .docx is a zip archive,
 * so it starts with the zip local-file-header signature (0x50 0x4B 0x03 0x04).
 */
export function detectSyllabusFileKind(fileBase64: string): SyllabusFileKind | null {
  if (fileBase64.startsWith('JVBERi0')) return 'pdf';
  if (fileBase64.startsWith('UEsDB')) return 'docx';
  return null;
}

/** Plain text only - no layout, no AI. Good enough for the heuristic
 * line-based policy diff in `lib/syllabus/diffEngine.ts`, not for anything
 * that needs the document's structure. */
export async function extractRawSyllabusText(
  fileBase64: string,
  fileKind: SyllabusFileKind,
): Promise<string> {
  const buffer = Buffer.from(fileBase64, 'base64');

  if (fileKind === 'docx') {
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ buffer });
    return result.value.trim();
  }

  const { PDFParse } = await import('pdf-parse');
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return result.text.trim();
  } finally {
    await parser.destroy();
  }
}
