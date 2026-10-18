import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/requireUser';
import { adminDb } from '@/lib/firebase/adminFirestore';
import { CALENDAR_FEEDS_COLLECTION, generateCalendarFeedToken } from '@/lib/calendarFeed/token';

export const runtime = 'nodejs';

const NO_STORE = { 'Cache-Control': 'no-store' };

/**
 * A user's current feed is the mapping doc whose `uid` matches theirs, so
 * there is no second place to keep in sync. Removing every doc for the uid
 * is what makes "reset" and "turn off" stop the old URL from working.
 */
async function deleteFeedsFor(uid: string): Promise<void> {
  if (!adminDb) return;
  const existing = await adminDb
    .collection(CALENDAR_FEEDS_COLLECTION)
    .where('uid', '==', uid)
    .get();
  await Promise.all(existing.docs.map((d) => d.ref.delete()));
}

/** Creates the user's calendar feed token, or rotates it if one exists. */
export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401, headers: NO_STORE });
  }
  if (!adminDb) {
    return NextResponse.json(
      { error: 'Calendar feeds are not configured on the server.' },
      { status: 503, headers: NO_STORE },
    );
  }

  try {
    // Old links go first so a failure never leaves two live links behind.
    await deleteFeedsFor(user.uid);
    const token = generateCalendarFeedToken();
    await adminDb
      .collection(CALENDAR_FEEDS_COLLECTION)
      .doc(token)
      .create({ uid: user.uid, createdAt: new Date().toISOString() });
    return NextResponse.json({ token }, { headers: NO_STORE });
  } catch (err) {
    console.error('Failed to create calendar feed:', err);
    return NextResponse.json(
      { error: "Couldn't create the calendar link. Try again." },
      { status: 500, headers: NO_STORE },
    );
  }
}

/** Reports whether the user currently has a feed, and its token if so. */
export async function GET(req: NextRequest) {
  const user = await requireUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401, headers: NO_STORE });
  }
  if (!adminDb) {
    return NextResponse.json(
      { error: 'Calendar feeds are not configured on the server.' },
      { status: 503, headers: NO_STORE },
    );
  }

  try {
    const existing = await adminDb
      .collection(CALENDAR_FEEDS_COLLECTION)
      .where('uid', '==', user.uid)
      .limit(1)
      .get();
    return NextResponse.json({ token: existing.docs[0]?.id ?? null }, { headers: NO_STORE });
  } catch (err) {
    console.error('Failed to read calendar feed:', err);
    return NextResponse.json(
      { error: "Couldn't load your calendar link." },
      { status: 500, headers: NO_STORE },
    );
  }
}

/** Revokes the user's calendar feed. Safe to call when none exists. */
export async function DELETE(req: NextRequest) {
  const user = await requireUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401, headers: NO_STORE });
  }
  if (!adminDb) {
    return NextResponse.json(
      { error: 'Calendar feeds are not configured on the server.' },
      { status: 503, headers: NO_STORE },
    );
  }

  try {
    await deleteFeedsFor(user.uid);
    return NextResponse.json({ success: true }, { headers: NO_STORE });
  } catch (err) {
    console.error('Failed to revoke calendar feed:', err);
    return NextResponse.json(
      { error: "Couldn't turn off the calendar link. Try again." },
      { status: 500, headers: NO_STORE },
    );
  }
}
