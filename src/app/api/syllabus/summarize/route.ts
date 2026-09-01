import { NextRequest, NextResponse } from 'next/server';
import type Anthropic from '@anthropic-ai/sdk';
import { verifyFirebaseIdToken } from '@/lib/auth/verifyFirebaseIdToken';
import { adminStorage } from '@/lib/firebase/adminStorage';
import { getAnthropicClient, SYLLABUS_EXTRACTION_MODEL } from '@/lib/ai/anthropic';
import { COURSE_SUMMARY_SYSTEM_PROMPT, COURSE_SUMMARY_TOOL } from '@/lib/ai/courseSummaryTool';
import { courseSummarySchema } from '@/types/courseSummary';
import { checkRateLimit } from '@/lib/security/rateLimit';
import { rateLimitedResponse } from '@/lib/security/rateLimitResponse';

export const runtime = 'nodejs';
export const maxDuration = 120;

// Same rationale as extract/route.ts - an expensive per-request Anthropic
// call, limited per-uid to bound cost and abuse.
const SUMMARIZE_RATE_LIMIT = { limit: 10, windowMs: 60_000 };

async function requireUser(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  if (!token || !projectId) return null;
  try {
    return await verifyFirebaseIdToken(token, projectId);
  } catch {
    return null;
  }
}

/**
 * Summarizes an already-uploaded syllabus into a plain-English course
 * summary plus "important notes" the student could get burned by missing -
 * reuses the same daily AI-usage budget as extraction (checkAndIncrement-
 * ExtractionCount) rather than a separate limiter, since both are Anthropic
 * calls against a student's own uploaded documents.
 *
 * Takes the file's storage path directly (not a syllabus id looked up
 * server-side) - same trust model as the file proxy: the path is checked
 * against the caller's own `users/{uid}/...` prefix, so a client-supplied
 * path can't read anyone else's file.
 */
export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const limitResult = await checkRateLimit(`uid:${user.uid}:summarize`, SUMMARIZE_RATE_LIMIT);
  const blocked = rateLimitedResponse(limitResult);
  if (blocked) return blocked;

  let body: { storagePath?: string; fileName?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const { storagePath, fileName } = body;
  if (!storagePath || !fileName) {
    return NextResponse.json({ error: 'Missing storagePath or fileName.' }, { status: 400 });
  }
  if (!storagePath.startsWith(`users/${user.uid}/`)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  const fileKind = fileName.toLowerCase().endsWith('.pdf')
    ? 'pdf'
    : fileName.toLowerCase().endsWith('.docx')
      ? 'docx'
      : null;
  if (!fileKind) {
    return NextResponse.json(
      { error: 'Only PDF and .docx syllabi can be summarized.' },
      { status: 400 },
    );
  }

  if (!adminStorage) {
    return NextResponse.json(
      { error: 'Storage is not configured on the server.' },
      { status: 500 },
    );
  }

  let fileBase64: string;
  try {
    const file = adminStorage.bucket().file(storagePath);
    const [bytes] = await file.download();
    fileBase64 = bytes.toString('base64');
  } catch {
    return NextResponse.json({ error: "Couldn't read that file." }, { status: 404 });
  }

  let docxText: string | null = null;
  if (fileKind === 'docx') {
    try {
      const mammoth = await import('mammoth');
      const buffer = Buffer.from(fileBase64, 'base64');
      const result = await mammoth.extractRawText({ buffer });
      docxText = result.value.trim();
    } catch {
      return NextResponse.json(
        { error: "Couldn't read that Word document. Try re-saving it and uploading again." },
        { status: 400 },
      );
    }
    if (!docxText) {
      return NextResponse.json({ error: 'That document appears to be empty.' }, { status: 400 });
    }
  }

  let anthropic;
  try {
    anthropic = getAnthropicClient();
  } catch {
    return NextResponse.json(
      { error: 'Course summarization is not configured on the server.' },
      { status: 503 },
    );
  }

  const documentContent: Anthropic.MessageParam['content'] =
    fileKind === 'pdf'
      ? [
          {
            type: 'document',
            source: { type: 'base64', media_type: 'application/pdf', data: fileBase64 },
            title: fileName,
          },
          { type: 'text', text: 'Summarize this syllabus into the record_course_summary tool.' },
        ]
      : [
          {
            type: 'text',
            text: `Syllabus document (${fileName}), extracted from a Word file:\n\n${docxText}`,
          },
          { type: 'text', text: 'Summarize this syllabus into the record_course_summary tool.' },
        ];

  let message;
  try {
    message = await anthropic.messages.create({
      model: SYLLABUS_EXTRACTION_MODEL,
      max_tokens: 2000,
      system: COURSE_SUMMARY_SYSTEM_PROMPT,
      tools: [COURSE_SUMMARY_TOOL],
      tool_choice: { type: 'tool', name: COURSE_SUMMARY_TOOL.name },
      messages: [{ role: 'user', content: documentContent }],
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Summarization request failed.' },
      { status: 502 },
    );
  }

  const toolUse = message.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use',
  );
  if (!toolUse) {
    return NextResponse.json(
      { error: 'The model did not return structured data. Try again.' },
      { status: 502 },
    );
  }

  const parsed = courseSummarySchema.safeParse(toolUse.input);
  if (!parsed.success) {
    console.error('Course summary validation failed:', parsed.error.issues);
    return NextResponse.json({ error: 'The summary was malformed. Try again.' }, { status: 502 });
  }

  return NextResponse.json({ result: parsed.data });
}
