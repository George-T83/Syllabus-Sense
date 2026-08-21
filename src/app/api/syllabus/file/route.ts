import { NextRequest, NextResponse } from 'next/server';
import { verifyFirebaseIdToken } from '@/lib/auth/verifyFirebaseIdToken';
import { adminStorage } from '@/lib/firebase/adminStorage';

export const runtime = 'nodejs';

/**
 * Same-origin relay for a syllabus file's bytes, authenticated per-request
 * rather than relying on a Storage download-token URL.
 *
 * Two problems this solves at once:
 * 1. The bucket has no CORS configuration, so a browser fetch()/XHR against
 *    firebasestorage.googleapis.com is blocked cross-origin - only
 *    navigation (<a>, <iframe src>) works directly. The in-app PDF (pdfjs)
 *    and .docx (mammoth) viewers both need to read bytes via JS, so this
 *    route fetches server-side (not subject to browser CORS) instead.
 * 2. The Storage object path is `.../{uuid}-{fileName}` (the uuid keeps
 *    concurrent uploads from colliding), so the raw download URL - and
 *    anything that reads its Content-Disposition, like a saved download -
 *    exposes that uuid. This route sets its own Content-Disposition from
 *    the caller's `name` param, so what the user sees/downloads is always
 *    their own clean filename.
 *
 * Requires a valid Firebase ID token whose uid matches the requested path's
 * `users/{uid}/...` prefix - real per-user authorization, not just an
 * unguessable-but-unauthenticated token embedded in a URL.
 */
export async function GET(req: NextRequest) {
  const path = req.nextUrl.searchParams.get('path');
  const name = req.nextUrl.searchParams.get('name');
  if (!path || !name) {
    return NextResponse.json({ error: 'Missing path or name parameter.' }, { status: 400 });
  }

  const authHeader = req.headers.get('authorization');
  // A direct <a href> navigation (Open in new tab / Download) can't attach
  // an Authorization header, so it falls back to a `token` query param -
  // same trust model as Firebase's own download-token URLs, which this
  // route replaces.
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7)
    : req.nextUrl.searchParams.get('token');
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  if (!token || !projectId) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  let uid: string;
  try {
    uid = (await verifyFirebaseIdToken(token, projectId)).uid;
  } catch {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  if (!path.startsWith(`users/${uid}/`)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  if (!adminStorage) {
    return NextResponse.json({ error: 'Storage is not configured.' }, { status: 500 });
  }

  try {
    const file = adminStorage.bucket().file(path);
    const [exists] = await file.exists();
    if (!exists) {
      return NextResponse.json({ error: 'File not found.' }, { status: 404 });
    }

    const [metadata] = await file.getMetadata();
    const [bytes] = await file.download();
    const disposition =
      req.nextUrl.searchParams.get('disposition') === 'attachment' ? 'attachment' : 'inline';

    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        'Content-Type': metadata.contentType ?? 'application/octet-stream',
        'Content-Length': String(bytes.length),
        'Content-Disposition': `${disposition}; filename="${encodeURIComponent(name)}"`,
        'Cache-Control': 'private, max-age=300',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Could not fetch file.' }, { status: 502 });
  }
}
