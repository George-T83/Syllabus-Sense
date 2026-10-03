import { toProxyUrl } from '@/lib/syllabus/proxyUrl';

/** Fetches a syllabus file through the proxy with the token in a header. */
export async function fetchProxiedFile(
  storagePath: string,
  fileName: string,
  authToken: string,
  disposition: 'inline' | 'attachment',
): Promise<Blob> {
  const response = await fetch(toProxyUrl(storagePath, fileName, { disposition }), {
    headers: { Authorization: `Bearer ${authToken}` },
  });
  if (!response.ok) throw new Error(`File request failed (${response.status}).`);
  return response.blob();
}

/** Saves a blob under a clean file name. */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Give the browser a moment to start the download before releasing it.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Opens a PDF blob in a new tab.
 *
 * The tab is opened synchronously, inside the click, because browsers block
 * a window.open() that happens after an await. It starts blank and is
 * pointed at the blob once the bytes arrive. Only a PDF is ever opened this
 * way: the proxy labels everything else as a download, and a blob that is
 * not application/pdf is saved instead, so nothing but a PDF can end up
 * rendered as a page on the app's origin. */
export async function openPdfInNewTab(load: () => Promise<Blob>, fileName: string): Promise<void> {
  const tab = window.open('', '_blank');
  if (tab) tab.opener = null;
  try {
    const blob = await load();
    if (blob.type !== 'application/pdf') {
      tab?.close();
      downloadBlob(blob, fileName);
      return;
    }
    const url = URL.createObjectURL(blob);
    if (tab) tab.location.href = url;
    else downloadBlob(blob, fileName);
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (err) {
    tab?.close();
    throw err;
  }
}
