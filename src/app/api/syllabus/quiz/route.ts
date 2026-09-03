import { NextRequest, NextResponse } from 'next/server';
import type Anthropic from '@anthropic-ai/sdk';
import { verifyFirebaseIdToken } from '@/lib/auth/verifyFirebaseIdToken';
import { adminStorage } from '@/lib/firebase/adminStorage';
import { getAnthropicClient, SYLLABUS_EXTRACTION_MODEL } from '@/lib/ai/anthropic';
import { QUIZ_SYSTEM_PROMPT, QUIZ_TOOL } from '@/lib/ai/quizTool';
import { generatedQuizQuestionsSchema } from '@/types/quiz';

export const runtime = 'nodejs';
export const maxDuration = 120;

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
 * Generates a practice quiz from an already-uploaded syllabus. Same trust
 * model and file-handling shape as /api/syllabus/summarize and
 * /api/syllabus/flashcards: the client supplies the file's own storage
 * path, checked against the caller's own `users/{uid}/...` prefix so a
 * client-supplied path can't read anyone else's file.
 */
export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

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
      { error: 'Only PDF and .docx syllabi can generate a quiz.' },
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
      { error: 'Quiz generation is not configured on the server.' },
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
          { type: 'text', text: 'Generate a practice quiz from this syllabus using record_quiz.' },
        ]
      : [
          {
            type: 'text',
            text: `Syllabus document (${fileName}), extracted from a Word file:\n\n${docxText}`,
          },
          { type: 'text', text: 'Generate a practice quiz from this syllabus using record_quiz.' },
        ];

  let message;
  try {
    message = await anthropic.messages.create({
      model: SYLLABUS_EXTRACTION_MODEL,
      max_tokens: 4000,
      system: QUIZ_SYSTEM_PROMPT,
      tools: [QUIZ_TOOL],
      tool_choice: { type: 'tool', name: QUIZ_TOOL.name },
      messages: [{ role: 'user', content: documentContent }],
    });
  } catch (err) {
    console.error('Anthropic call failed in quiz generation:', err);
    return NextResponse.json({ error: 'Quiz generation request failed.' }, { status: 502 });
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

  const input = toolUse.input as { questions?: unknown };
  const parsed = generatedQuizQuestionsSchema.safeParse(input.questions);
  if (!parsed.success) {
    console.error('Quiz validation failed:', parsed.error.issues);
    return NextResponse.json(
      { error: 'The generated quiz was malformed. Try again.' },
      { status: 502 },
    );
  }

  return NextResponse.json({ questions: parsed.data });
}
