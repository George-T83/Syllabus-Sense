/** Builds a URL to the same-origin syllabus file proxy
 * (src/app/api/syllabus/file/route.ts), which serves a file's bytes under
 * its clean display name instead of the uuid-prefixed Storage object path,
 * and requires the requester to own it.
 *
 * The caller must send its Firebase ID token in an `Authorization: Bearer`
 * header. It is never accepted in the URL: a URL is stored in history,
 * server logs and Referer headers. Open and Download therefore fetch the
 * bytes with the header and hand the browser a blob (see `proxyFile.ts`)
 * instead of navigating to this URL. */
export function toProxyUrl(
  storagePath: string,
  fileName: string,
  options?: { disposition?: 'inline' | 'attachment' },
): string {
  const params = new URLSearchParams({ path: storagePath, name: fileName });
  if (options?.disposition) params.set('disposition', options.disposition);
  return `/api/syllabus/file?${params.toString()}`;
}
