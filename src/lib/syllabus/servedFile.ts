/**
 * How the same-origin file proxy (src/app/api/syllabus/file/route.ts) labels
 * the bytes it serves.
 *
 * The proxy runs on the app's own origin, so a file it serves as `text/html`
 * or `image/svg+xml` would execute script with the signed-in student's
 * session. The Content-Type stored on the Storage object is whatever the
 * uploader declared, so it is never trusted: the type is decided here from
 * the file's own leading bytes, and anything that is not a PDF or a .docx
 * goes out as an opaque download.
 */

export type ServedFileKind = 'pdf' | 'docx' | 'other';

export interface ServedFileHeaders {
  'Content-Type': string;
  'Content-Disposition': string;
  'X-Content-Type-Options': 'nosniff';
  'Content-Security-Policy': string;
}

const CONTENT_TYPES: Record<ServedFileKind, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  other: 'application/octet-stream',
};

/** "%PDF-" for a PDF; the zip local-file-header signature for a .docx (a
 * .docx is a zip archive, and the name must say so too, since any other zip
 * is not something this app previews). */
export function detectServedFileKind(bytes: Uint8Array, fileName: string): ServedFileKind {
  if (
    bytes.length >= 5 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46 &&
    bytes[4] === 0x2d
  ) {
    return 'pdf';
  }
  if (
    bytes.length >= 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    bytes[2] === 0x03 &&
    bytes[3] === 0x04 &&
    /\.docx$/i.test(fileName)
  ) {
    return 'docx';
  }
  return 'other';
}

/** RFC 5987 form, so a name with quotes, newlines or non-ASCII characters
 * cannot break out of the header value. */
function contentDisposition(disposition: 'inline' | 'attachment', fileName: string): string {
  const ascii = fileName.replace(/[^\x20-\x7e]|["\\]/g, '_');
  return `${disposition}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

/** Only a PDF is ever shown inline; every other kind is forced to download,
 * whatever the caller asked for. */
export function buildServedFileHeaders(
  kind: ServedFileKind,
  fileName: string,
  requested: 'inline' | 'attachment',
): ServedFileHeaders {
  const disposition = kind === 'pdf' ? requested : 'attachment';
  return {
    'Content-Type': CONTENT_TYPES[kind],
    'Content-Disposition': contentDisposition(disposition, fileName),
    // Stops the browser second-guessing the type above from the content.
    'X-Content-Type-Options': 'nosniff',
    // Defence in depth: even if something rendered this response as a page, it
    // would be an empty, scriptless, sandboxed document.
    'Content-Security-Policy': "default-src 'none'; sandbox",
  };
}
