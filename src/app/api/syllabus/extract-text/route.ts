import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/requireUser';
import { createRateLimiter } from '@/lib/rateLimit';
import { detectSyllabusFileKind, extractRawSyllabusText } from '@/lib/syllabus/extractRawText';

export const runtime = 'nodejs';
export const maxDuration = 30;

const MAX_FILE_BYTES = 10 * 1024 * 1024;

/** 20 extractions a minute per account: a syllabus version diff needs two. */
const checkRate = createRateLimiter(20, 60_000);

/**
 * Plain text extraction only - no Anthropic call. Backs the syllabus
 * version-diff feature, which only needs comparable text between two
 * uploads, not structured data. Kept as its own route (rather than a mode
 * on `/api/syllabus/extract`) so it can never accidentally end up on the
 * AI-billed code path.
 */
export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const rate = checkRate(user.uid);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Try again in a moment.' },
      { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds) } },
    );
  }

  let body: { fileBase64?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const { fileBase64 } = body;
  if (!fileBase64 || typeof fileBase64 !== 'string') {
    return NextResponse.json({ error: 'Missing file.' }, { status: 400 });
  }
  if (fileBase64.length > MAX_FILE_BYTES * 1.4) {
    return NextResponse.json({ error: 'File is too large (max 10MB).' }, { status: 400 });
  }

  const fileKind = detectSyllabusFileKind(fileBase64);
  if (!fileKind) {
    return NextResponse.json(
      { error: 'That file is not a valid PDF or Word (.docx) document.' },
      { status: 400 },
    );
  }

  try {
    const text = await extractRawSyllabusText(fileBase64, fileKind);
    return NextResponse.json({ text });
  } catch (err) {
    console.error('Raw syllabus text extraction failed:', err);
    return NextResponse.json({ error: "Couldn't read that document." }, { status: 400 });
  }
}
