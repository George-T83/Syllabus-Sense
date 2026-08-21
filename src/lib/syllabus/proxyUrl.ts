/** Builds a URL to the same-origin syllabus file proxy
 * (src/app/api/syllabus/file/route.ts), which serves a file's bytes under
 * its clean display name instead of the uuid-prefixed Storage object path,
 * and requires the requester to own it. `token` is only needed for a plain
 * <a href> navigation (Open in new tab / Download), which can't attach an
 * Authorization header - fetch()-based callers (the PDF/docx viewers)
 * should pass the ID token as a header instead and omit it here. */
export function toProxyUrl(
  storagePath: string,
  fileName: string,
  options?: { token?: string; disposition?: 'inline' | 'attachment' },
): string {
  const params = new URLSearchParams({ path: storagePath, name: fileName });
  if (options?.token) params.set('token', options.token);
  if (options?.disposition) params.set('disposition', options.disposition);
  return `/api/syllabus/file?${params.toString()}`;
}
