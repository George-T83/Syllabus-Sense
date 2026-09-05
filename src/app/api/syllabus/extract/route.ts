import { NextRequest, NextResponse } from 'next/server';
import type Anthropic from '@anthropic-ai/sdk';
import { verifyFirebaseIdToken } from '@/lib/auth/verifyFirebaseIdToken';
import { getAnthropicClient, SYLLABUS_EXTRACTION_MODEL } from '@/lib/ai/anthropic';
import {
  SYLLABUS_EXTRACTION_SYSTEM_PROMPT,
  SYLLABUS_EXTRACTION_TOOL,
} from '@/lib/ai/syllabusExtractionTool';
import { syllabusExtractionSchema } from '@/types/extraction';
import { detectSyllabusFileKind, extractRawSyllabusText } from '@/lib/syllabus/extractRawText';

export const runtime = 'nodejs';
export const maxDuration = 120;

const MAX_FILE_BYTES = 10 * 1024 * 1024;

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

export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  let body: { fileBase64?: string; fileName?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const { fileBase64, fileName } = body;
  if (!fileBase64 || typeof fileBase64 !== 'string') {
    return NextResponse.json({ error: 'Missing file.' }, { status: 400 });
  }
  // Rough size check on the base64 payload (base64 is ~4/3 the byte size).
  if (fileBase64.length > MAX_FILE_BYTES * 1.4) {
    return NextResponse.json({ error: 'File is too large (max 10MB).' }, { status: 400 });
  }
  // The client declares a MIME type, but that's spoofable - check the real
  // magic bytes server-side before spending an API call.
  const fileKind = detectSyllabusFileKind(fileBase64);
  if (!fileKind) {
    return NextResponse.json(
      { error: 'That file is not a valid PDF or Word (.docx) document.' },
      { status: 400 },
    );
  }

  // Claude has native PDF understanding, but not .docx - a .docx is
  // extracted to plain text server-side first and sent as a text block
  // instead of a document block.
  let docxText: string | null = null;
  if (fileKind === 'docx') {
    try {
      docxText = await extractRawSyllabusText(fileBase64, 'docx');
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
      { error: 'Syllabus extraction is not configured on the server.' },
      { status: 503 },
    );
  }

  const today = new Date().toISOString().slice(0, 10);

  const documentContent: Anthropic.MessageParam['content'] =
    fileKind === 'pdf'
      ? [
          {
            type: 'document',
            source: { type: 'base64', media_type: 'application/pdf', data: fileBase64 },
            ...(fileName ? { title: fileName } : {}),
          },
          {
            type: 'text',
            text: 'Extract this syllabus into the record_syllabus_extraction tool.',
          },
        ]
      : [
          {
            type: 'text',
            text: `Syllabus document${fileName ? ` (${fileName})` : ''}, extracted from a Word file:\n\n${docxText}`,
          },
          {
            type: 'text',
            text: 'Extract this syllabus into the record_syllabus_extraction tool.',
          },
        ];

  let message;
  try {
    message = await anthropic.messages.create({
      model: SYLLABUS_EXTRACTION_MODEL,
      max_tokens: 8000,
      system: `${SYLLABUS_EXTRACTION_SYSTEM_PROMPT}\n\nToday's date is ${today} - use it only to disambiguate a term/year if the syllabus itself doesn't state one clearly.`,
      tools: [SYLLABUS_EXTRACTION_TOOL],
      tool_choice: { type: 'tool', name: SYLLABUS_EXTRACTION_TOOL.name },
      messages: [{ role: 'user', content: documentContent }],
    });
  } catch (err) {
    // Logged server-side only - the raw SDK error can include request-shape
    // or account-tier detail that shouldn't reach the client.
    console.error('Anthropic call failed in syllabus extraction:', err);
    return NextResponse.json({ error: 'Extraction request failed.' }, { status: 502 });
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

  const parsed = syllabusExtractionSchema.safeParse(toolUse.input);
  if (!parsed.success) {
    console.error('Syllabus extraction validation failed:', parsed.error.issues);
    return NextResponse.json(
      { error: 'The extracted data was malformed. Try again.' },
      { status: 502 },
    );
  }

  // Guarantee the "CSCI 213" spacing the prompt asks for even if the model
  // copies a source syllabus's unspaced code (e.g. "CSCI213") verbatim.
  parsed.data.course.code = parsed.data.course.code.replace(/^([A-Za-z]+)(\d)/, '$1 $2');

  return NextResponse.json({ result: parsed.data });
}
