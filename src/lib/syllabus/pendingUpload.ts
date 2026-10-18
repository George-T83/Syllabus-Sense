/**
 * Syllabi too big to send inside the extraction request are uploaded to
 * Storage first and read from there. The host caps a request body at about
 * 4.5MB, and a file sent as base64 grows by a third, so anything over ~3MB
 * would fail long before the 10MB the upload box promises.
 *
 * These files live under the signed-in student's own syllabi folder in a
 * `_pending` subfolder, and the extract route deletes them as soon as it has
 * read them.
 */

/** Largest file sent inline in the request; bigger ones go through Storage. */
export const INLINE_UPLOAD_LIMIT_BYTES = 3 * 1024 * 1024;

export function pendingUploadPrefix(uid: string): string {
  return `users/${uid}/syllabi/_pending/`;
}

/** True only for a file in this student's own pending folder. */
export function isPendingUploadPath(uid: string, path: unknown): path is string {
  return (
    typeof path === 'string' &&
    path.startsWith(pendingUploadPrefix(uid)) &&
    !path.includes('..') &&
    path.length > pendingUploadPrefix(uid).length
  );
}
