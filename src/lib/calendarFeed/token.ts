import { randomBytes } from 'crypto';

/** Firestore collection mapping a feed token to the user who owns it. Server-only. */
export const CALENDAR_FEEDS_COLLECTION = 'calendarFeeds';

/** 24 random bytes encode to exactly 32 base64url characters. */
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{32}$/;

/** Creates an unguessable feed token (192 bits of randomness). */
export function generateCalendarFeedToken(): string {
  return randomBytes(24).toString('base64url');
}

/**
 * True only for strings shaped like a token we issue. Checked before any
 * Firestore read so arbitrary path segments never reach the database.
 */
export function isValidCalendarFeedToken(value: string): boolean {
  return TOKEN_PATTERN.test(value);
}
