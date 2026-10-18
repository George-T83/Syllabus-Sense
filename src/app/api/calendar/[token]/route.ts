import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/adminFirestore';
import { buildCalendarFeed } from '@/lib/calendarFeed/buildFeed';
import { CALENDAR_FEEDS_COLLECTION, isValidCalendarFeedToken } from '@/lib/calendarFeed/token';
import { loadFeedData } from '@/lib/calendarFeed/loadFeedData';

export const runtime = 'nodejs';

const bare = (status: number) =>
  new NextResponse(null, { status, headers: { 'X-Robots-Tag': 'noindex' } });

/**
 * Subscribable calendar feed. The unguessable token in the URL is the only
 * credential: calendar apps cannot send an Authorization header. Unknown and
 * malformed tokens get the same empty 404 so nothing is revealed about which
 * tokens exist, and the response never contains the owner's uid.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!isValidCalendarFeedToken(token)) return bare(404);

  if (!adminDb) return bare(503);

  try {
    const mapping = await adminDb.collection(CALENDAR_FEEDS_COLLECTION).doc(token).get();
    const uid = mapping.exists ? mapping.data()?.uid : undefined;
    if (typeof uid !== 'string' || !uid) return bare(404);

    const { courses, items } = await loadFeedData(adminDb, uid);
    const ics = buildCalendarFeed(items, courses, new Date());

    return new NextResponse(ics, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Cache-Control': 'private, max-age=300',
        'X-Robots-Tag': 'noindex',
      },
    });
  } catch (err) {
    console.error('Failed to build calendar feed:', err);
    return bare(500);
  }
}
