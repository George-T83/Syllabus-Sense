// SCRATCH SCRIPT - not part of the app, never commit. Exercises the exact
// same extraction path as src/app/api/syllabus/extract/route.ts (same
// system prompt, tool schema, model, zod validation) against real fixture
// syllabi, bypassing only the Next.js/Firebase-auth request plumbing.
import fs from 'node:fs';
import path from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import mammoth from 'mammoth';
import {
  SYLLABUS_EXTRACTION_SYSTEM_PROMPT,
  SYLLABUS_EXTRACTION_TOOL,
} from '../src/lib/ai/syllabusExtractionTool';
import { syllabusExtractionSchema } from '../src/types/extraction';

const SYLLABUS_EXTRACTION_MODEL = 'claude-sonnet-5';

const FIXTURES_DIR = path.join(__dirname, '..', 'test-fixtures', 'syllabi');
const OUT_DIR =
  '/tmp/claude-0/-home-user-Syllabus-Sense/f2405365-faf6-59ae-9faa-e46055a022ec/scratchpad/extractions';

function detectFileKind(fileBase64: string): 'pdf' | 'docx' | null {
  if (fileBase64.startsWith('JVBERi0')) return 'pdf';
  if (fileBase64.startsWith('UEsDB')) return 'docx';
  return null;
}

async function extractOne(anthropic: Anthropic, filePath: string) {
  const fileName = path.basename(filePath);
  const fileBase64 = fs.readFileSync(filePath).toString('base64');
  const fileKind = detectFileKind(fileBase64);
  if (!fileKind) throw new Error(`${fileName}: not a recognized PDF/DOCX`);

  let docxText: string | null = null;
  if (fileKind === 'docx') {
    const buffer = Buffer.from(fileBase64, 'base64');
    const result = await mammoth.extractRawText({ buffer });
    docxText = result.value.trim();
  }

  const documentContent: Anthropic.MessageParam['content'] =
    fileKind === 'pdf'
      ? [
          {
            type: 'document',
            source: { type: 'base64', media_type: 'application/pdf', data: fileBase64 },
            title: fileName,
          },
          { type: 'text', text: 'Extract this syllabus into the record_syllabus_extraction tool.' },
        ]
      : [
          {
            type: 'text',
            text: `Syllabus document (${fileName}), extracted from a Word file:\n\n${docxText}`,
          },
          { type: 'text', text: 'Extract this syllabus into the record_syllabus_extraction tool.' },
        ];

  const today = new Date().toISOString().slice(0, 10);
  const message = await anthropic.messages.create({
    model: SYLLABUS_EXTRACTION_MODEL,
    max_tokens: 8000,
    system: `${SYLLABUS_EXTRACTION_SYSTEM_PROMPT}\n\nToday's date is ${today} - use it only to disambiguate a term/year if the syllabus itself doesn't state one clearly.`,
    tools: [SYLLABUS_EXTRACTION_TOOL],
    tool_choice: { type: 'tool', name: SYLLABUS_EXTRACTION_TOOL.name },
    messages: [{ role: 'user', content: documentContent }],
  });

  const toolUse = message.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use',
  );
  if (!toolUse) throw new Error(`${fileName}: model did not return structured data`);

  // Defensive truncation only, to observe real known-good data even when one
  // field overshoots its cap - the real API route has no such guard and
  // would 502 on this input as-is (flagged separately, not silently patched
  // in production code).
  const input = toolUse.input as Record<string, unknown>;
  if (Array.isArray(input.unresolved)) {
    input.unresolved = input.unresolved.map((s) =>
      typeof s === 'string' && s.length > 300 ? s.slice(0, 297) + '...' : s,
    );
  }

  const parsed = syllabusExtractionSchema.safeParse(input);
  if (!parsed.success) {
    console.error(`${fileName}: validation failed`, JSON.stringify(parsed.error.issues, null, 2));
    throw new Error(`${fileName}: extracted data failed schema validation`);
  }
  return { fileName, data: parsed.data };
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not set');
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const only = process.argv[2];
  const files = fs
    .readdirSync(FIXTURES_DIR)
    .filter((f) => /\.(pdf|docx)$/i.test(f))
    .filter((f) => !only || f.toLowerCase().includes(only.toLowerCase()))
    .sort();

  console.log(`Found ${files.length} fixture syllabi:`, files);

  for (const file of files) {
    const filePath = path.join(FIXTURES_DIR, file);
    process.stdout.write(`Extracting ${file}... `);
    try {
      const { fileName, data } = await extractOne(anthropic, filePath);
      const outPath = path.join(OUT_DIR, fileName.replace(/\.(pdf|docx)$/i, '.json'));
      fs.writeFileSync(outPath, JSON.stringify(data, null, 2));
      console.log(
        `OK -> ${data.course.code} ${data.course.title} | ${data.scheduleItems.length} items | ${data.course.contacts.length} contacts | ${data.course.learningObjectives.length} objectives`,
      );
    } catch (err) {
      console.log(`FAILED: ${err instanceof Error ? err.message : err}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
