/**
 * Turns the AI's suggested-chunk JSON into planner tasks, one chunk at a
 * time: a bad chunk is dropped with a plain-language reason and never takes
 * the rest of the answer down with it.
 *
 * Day arithmetic is done on `YYYY-MM-DD` keys with UTC math, so it can't be
 * thrown by the server's time zone or a DST change.
 */

/** Furthest out a suggested step may land - a study plan, not a calendar. */
export const MAX_OFFSET_DAYS = 365;
/** Largest time estimate a single suggested step may carry. */
export const MAX_ESTIMATED_HOURS = 200;

const DAY_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86_400_000;

export interface SuggestedChunk {
  title: string;
  notes: string;
  estimatedHours: number;
  dueDate: string;
  type: string;
}

export interface SkippedChunk {
  title: string;
  reason: string;
}

function keyToUtcMs(key: string): number | null {
  const match = DAY_KEY.exec(key);
  if (!match) return null;
  const [, y, m, d] = match;
  const ms = Date.UTC(Number(y), Number(m) - 1, Number(d));
  const roundTrip = new Date(ms);
  // Date.UTC rolls 2026-02-31 over to March - reject anything that moved.
  if (
    roundTrip.getUTCFullYear() !== Number(y) ||
    roundTrip.getUTCMonth() !== Number(m) - 1 ||
    roundTrip.getUTCDate() !== Number(d)
  ) {
    return null;
  }
  return ms;
}

function utcMsToKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * The student's current day. The browser knows it; the server only knows
 * UTC, which is already "tomorrow" for a US evening. A client-supplied day
 * is trusted only if it is a real date within a day of the server's UTC day
 * (the widest any real time zone can differ); anything else is ignored.
 */
export function resolveStudentToday(clientDayKey: unknown, now: Date = new Date()): string {
  const serverKey = utcMsToKey(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (typeof clientDayKey !== 'string') return serverKey;
  const clientMs = keyToUtcMs(clientDayKey.trim());
  const serverMs = keyToUtcMs(serverKey);
  if (clientMs === null || serverMs === null) return serverKey;
  return Math.abs(clientMs - serverMs) <= DAY_MS ? utcMsToKey(clientMs) : serverKey;
}

export function addDaysToDayKey(dayKey: string, days: number): string | null {
  const ms = keyToUtcMs(dayKey);
  if (ms === null) return null;
  const result = new Date(ms + days * DAY_MS);
  return Number.isNaN(result.getTime()) ? null : result.toISOString().slice(0, 10);
}

/** A finite number from a number or numeric string; undefined when absent or junk. */
function toNumber(value: unknown): number | undefined {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

export function normalizeSuggestedChunk(
  raw: unknown,
  todayKey: string,
  validTypes: ReadonlySet<string>,
): { chunk: SuggestedChunk } | { skipped: SkippedChunk } {
  const chunk = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  const title = typeof chunk.title === 'string' && chunk.title.trim() ? chunk.title : 'Subtask';

  // A missing offset means "tomorrow"; an explicit 0 means today.
  const rawOffset = toNumber(chunk.dueDateOffsetDays);
  const offset = rawOffset === undefined ? 1 : Math.round(rawOffset);
  if (offset < 0) {
    return { skipped: { title, reason: 'its due date was before today' } };
  }
  if (offset > MAX_OFFSET_DAYS) {
    return {
      skipped: { title, reason: `its due date was more than ${MAX_OFFSET_DAYS} days away` },
    };
  }

  const rawHours = toNumber(chunk.estimatedHours);
  if (rawHours !== undefined && rawHours < 0) {
    return { skipped: { title, reason: 'its estimated hours were negative' } };
  }
  if (rawHours !== undefined && rawHours > MAX_ESTIMATED_HOURS) {
    return {
      skipped: { title, reason: `its estimated hours were more than ${MAX_ESTIMATED_HOURS}` },
    };
  }

  const dueDate = addDaysToDayKey(todayKey, offset);
  if (!dueDate) return { skipped: { title, reason: 'its due date could not be worked out' } };

  return {
    chunk: {
      title,
      notes: typeof chunk.notes === 'string' ? chunk.notes : '',
      estimatedHours: rawHours || 1,
      dueDate,
      type: typeof chunk.type === 'string' && validTypes.has(chunk.type) ? chunk.type : 'other',
    },
  };
}

export function parseSuggestedChunks(
  parsed: unknown[],
  todayKey: string,
  validTypes: ReadonlySet<string>,
): { chunks: SuggestedChunk[]; skipped: SkippedChunk[] } {
  const chunks: SuggestedChunk[] = [];
  const skipped: SkippedChunk[] = [];
  for (const raw of parsed) {
    const result = normalizeSuggestedChunk(raw, todayKey, validTypes);
    if ('chunk' in result) chunks.push(result.chunk);
    else skipped.push(result.skipped);
  }
  return { chunks, skipped };
}

/** One line telling the student what was left out and why. */
export function describeSkippedChunks(skipped: SkippedChunk[]): string {
  if (skipped.length === 0) return '';
  const list = skipped.map((s) => `"${s.title}" (${s.reason})`).join('; ');
  return `_Skipped ${skipped.length} suggested ${skipped.length === 1 ? 'task' : 'tasks'}: ${list}._`;
}
