import { NextRequest, NextResponse } from 'next/server';
import type Anthropic from '@anthropic-ai/sdk';
import { verifyFirebaseIdToken } from '@/lib/auth/verifyFirebaseIdToken';
import { adminStorage } from '@/lib/firebase/adminStorage';
import { getAnthropicClient, SYLLABUS_EXTRACTION_MODEL } from '@/lib/ai/anthropic';
import { buildCramPlanSystemPrompt, buildCramPlanTool } from '@/lib/ai/cramPlanTool';
import { generatedCramPlanSchema } from '@/types/cramPlan';

export const runtime = 'nodejs';
export const maxDuration = 120;

/** A cram plan longer than this stops being a "cram" (it's just the
 * semester) - the day count is clamped server-side too, not just in the UI
 * that computes it, since this route doesn't otherwise trust the caller's
 * arithmetic. */
const MAX_CRAM_DAYS = 14;

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
 * Generates a day-by-day exam review plan from an already-uploaded syllabus.
 * Same trust model and file-handling shape as /api/syllabus/summarize,
 * /api/syllabus/flashcards, and /api/syllabus/quiz.
 */
export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  let body: { storagePath?: string; fileName?: string; examTitle?: string; days?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const { storagePath, fileName, examTitle, days } = body;
  if (!storagePath || !fileName || !examTitle || !days) {
    return NextResponse.json(
      { error: 'Missing storagePath, fileName, examTitle, or days.' },
      { status: 400 },
    );
  }
  if (!Number.isInteger(days) || days < 1 || days > MAX_CRAM_DAYS) {
    return NextResponse.json(
      { error: `days must be an integer between 1 and ${MAX_CRAM_DAYS}.` },
      { status: 400 },
    );
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
      { error: 'Only PDF and .docx syllabi can generate a cram plan.' },
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
      { error: 'Cram plan generation is not configured on the server.' },
      { status: 503 },
    );
  }

  const cramTool = buildCramPlanTool(days);
  const documentContent: Anthropic.MessageParam['content'] =
    fileKind === 'pdf'
      ? [
          {
            type: 'document',
            source: { type: 'base64', media_type: 'application/pdf', data: fileBase64 },
            title: fileName,
          },
          { type: 'text', text: `Generate a ${days}-day cram plan using record_cram_plan.` },
        ]
      : [
          {
            type: 'text',
            text: `Syllabus document (${fileName}), extracted from a Word file:\n\n${docxText}`,
          },
          { type: 'text', text: `Generate a ${days}-day cram plan using record_cram_plan.` },
        ];

  let message;
  try {
    message = await anthropic.messages.create({
      model: SYLLABUS_EXTRACTION_MODEL,
      max_tokens: 2000,
      system: buildCramPlanSystemPrompt(examTitle, days),
      tools: [cramTool],
      tool_choice: { type: 'tool', name: cramTool.name },
      messages: [{ role: 'user', content: documentContent }],
    });
  } catch (err) {
    console.error('Anthropic call failed in cram plan generation:', err);
    return NextResponse.json({ error: 'Cram plan generation request failed.' }, { status: 502 });
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

  const input = toolUse.input as { topics?: unknown };
  const parsed = generatedCramPlanSchema(days).safeParse(input.topics);
  if (!parsed.success) {
    console.error('Cram plan validation failed:', parsed.error.issues);
    return NextResponse.json(
      { error: 'The generated cram plan was malformed. Try again.' },
      { status: 502 },
    );
  }

  return NextResponse.json({ topics: parsed.data });
}
