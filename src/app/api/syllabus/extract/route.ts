import { NextRequest, NextResponse } from 'next/server';
import type Anthropic from '@anthropic-ai/sdk';
import { verifyFirebaseIdToken } from '@/lib/auth/verifyFirebaseIdToken';
import { getAnthropicClient, SYLLABUS_EXTRACTION_MODEL } from '@/lib/ai/anthropic';
import { checkAndIncrementExtractionCount } from '@/lib/ai/extractionRateLimit';
import {
  SYLLABUS_EXTRACTION_SYSTEM_PROMPT,
  SYLLABUS_EXTRACTION_TOOL,
} from '@/lib/ai/syllabusExtractionTool';
import { syllabusExtractionSchema } from '@/types/extraction';

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
  // The client declares application/pdf, but that's a spoofable browser MIME
  // type - check the real magic bytes server-side before spending an API call.
  if (!fileBase64.startsWith('JVBERi0')) {
    return NextResponse.json({ error: 'That file is not a valid PDF.' }, { status: 400 });
  }

  const rateLimit = await checkAndIncrementExtractionCount(user.uid);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "You've hit today's syllabus upload limit. Try again tomorrow." },
      { status: 429 },
    );
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

  let message;
  try {
    message = await anthropic.messages.create({
      model: SYLLABUS_EXTRACTION_MODEL,
      max_tokens: 8000,
      system: `${SYLLABUS_EXTRACTION_SYSTEM_PROMPT}\n\nToday's date is ${today} - use it only to disambiguate a term/year if the syllabus itself doesn't state one clearly.`,
      tools: [SYLLABUS_EXTRACTION_TOOL],
      tool_choice: { type: 'tool', name: SYLLABUS_EXTRACTION_TOOL.name },
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: { type: 'base64', media_type: 'application/pdf', data: fileBase64 },
              ...(fileName ? { title: fileName } : {}),
            },
            {
              type: 'text',
              text: 'Extract this syllabus into the record_syllabus_extraction tool.',
            },
          ],
        },
      ],
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Extraction request failed.' },
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

  const parsed = syllabusExtractionSchema.safeParse(toolUse.input);
  if (!parsed.success) {
    console.error('Syllabus extraction validation failed:', parsed.error.issues);
    return NextResponse.json(
      { error: 'The extracted data was malformed. Try again.' },
      { status: 502 },
    );
  }

  return NextResponse.json({ result: parsed.data });
}
