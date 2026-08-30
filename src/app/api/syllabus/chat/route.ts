import { NextRequest, NextResponse } from 'next/server';
import type Anthropic from '@anthropic-ai/sdk';
import { verifyFirebaseIdToken } from '@/lib/auth/verifyFirebaseIdToken';
import { getAnthropicClient } from '@/lib/ai/anthropic';
import { generateOfflineSyllabusAnswer, type ChatRequestBody } from '@/lib/syllabus/chatEngine';

export const runtime = 'nodejs';
export const maxDuration = 60;

function detectFileKind(fileBase64: string): 'pdf' | 'docx' | null {
  if (fileBase64.startsWith('JVBERi0')) return 'pdf';
  if (fileBase64.startsWith('UEsDB')) return 'docx';
  return null;
}

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
  let body: ChatRequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  if (!body.message || typeof body.message !== 'string') {
    return NextResponse.json({ error: 'Missing message parameter.' }, { status: 400 });
  }

  // Optional authentication check (graceful for demo/dev)
  const user = await requireUser(req);
  const isProd = process.env.NODE_ENV === 'production';
  if (isProd && !user && process.env.FIREBASE_ADMIN_PROJECT_ID) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  // Parse file if provided
  let fileKind: 'pdf' | 'docx' | null = null;
  let docxText: string | null = null;

  if (body.fileBase64) {
    fileKind = detectFileKind(body.fileBase64);
    if (fileKind === 'docx') {
      try {
        const mammoth = await import('mammoth');
        const buffer = Buffer.from(body.fileBase64, 'base64');
        const result = await mammoth.extractRawText({ buffer });
        docxText = result.value.trim();
      } catch (err) {
        console.error('Failed to parse docx rubric file:', err);
      }
    }
  }

  // Check if Anthropic LLM is available
  const anthropic = getAnthropicClient();
  if (anthropic && process.env.ANTHROPIC_API_KEY) {
    try {
      const contentBlocks: Anthropic.MessageParam['content'] = [];

      // Add PDF block if it is a PDF
      if (fileKind === 'pdf' && body.fileBase64) {
        contentBlocks.push({
          type: 'document',
          source: { type: 'base64', media_type: 'application/pdf', data: body.fileBase64 },
          ...(body.fileName ? { title: body.fileName } : {}),
        });
      }

      let fileContext = '';
      if (fileKind === 'docx' && docxText) {
        fileContext = `Uploaded Assignment Rubric Document (${body.fileName || 'document.docx'}): \n\n${docxText}\n\n`;
      }

      const promptText = `You are the Syllabus Sense AI Study Copilot. You assist students by answering questions accurately based strictly on their syllabus.
Course Code: ${body.courseCode || 'General Course'}
Course Title: ${body.courseTitle || ''}
Instructor: ${body.instructor || ''}
Location: ${body.location || ''}
Materials: ${body.materials?.join(', ') || 'Standard materials'}
Objectives: ${body.learningObjectives?.join('; ') || 'Standard course objectives'}
Syllabus Content Context:
${body.syllabusText || body.notes || 'Standard university syllabus structure with homework, exams, and attendance policies.'}

${fileContext}Student Query: ${body.message}

If the user query or uploaded file describes a multi-step assignment, term paper, midterm exam prep, coding repository task, or final project, you MUST suggest a list of bite-sized planner tasks (subtasks) to help them divide their study workload. 

To suggest these subtasks, you must output a JSON structure at the very end of your response, separated by a line reading "---SUGGESTED_CHUNKS_START---" and closed by a line reading "---SUGGESTED_CHUNKS_END---". The JSON structure must be a valid JSON array of objects conforming to this schema:
[
  {
    "title": "Subtask short title",
    "notes": "Actionable task guidelines or instructions from the rubric",
    "estimatedHours": 1.5,
    "dueDateOffsetDays": 3,
    "type": "assignment"
  }
]
where:
- "estimatedHours" is the estimated time to complete that subtask (numbers like 1.5, 2, 0.5).
- "dueDateOffsetDays" is the recommended relative offset in days from today's date to complete this task (e.g. 2 means due in 2 days).
- "type" is one of: "project", "exam", "quiz", "assignment", "reading", "coding", "paper".

Format the main body of your answer with clear markdown headings, bullet points, and specific citations in brackets (e.g. [Syllabus § 3 - Grading Policy] or [Rubric - Format Requirements]). Be concise, encouraging, and academically precise.`;

      contentBlocks.push({
        type: 'text',
        text: promptText,
      });

      const response = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 2048,
        messages: [{ role: 'user', content: contentBlocks }],
      });

      const firstBlock = response.content[0];
      let textResponse = firstBlock && 'text' in firstBlock ? firstBlock.text : '';
      interface SuggestedChunkType {
        title: string;
        notes: string;
        estimatedHours: number;
        dueDate: string;
        type: string;
      }
      let suggestedChunks: SuggestedChunkType[] = [];

      const startTag = '---SUGGESTED_CHUNKS_START---';
      const endTag = '---SUGGESTED_CHUNKS_END---';
      const startIndex = textResponse.indexOf(startTag);
      const endIndex = textResponse.indexOf(endTag);

      if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
        const jsonStr = textResponse.slice(startIndex + startTag.length, endIndex).trim();
        try {
          const parsedChunks = JSON.parse(jsonStr);
          if (Array.isArray(parsedChunks)) {
            suggestedChunks = parsedChunks.map((chunk: Record<string, unknown>) => {
              const daysOffset = Number(chunk.dueDateOffsetDays) || 1;
              const targetDate = new Date();
              targetDate.setDate(targetDate.getDate() + daysOffset);
              return {
                title: typeof chunk.title === 'string' ? chunk.title : 'Subtask',
                notes: typeof chunk.notes === 'string' ? chunk.notes : '',
                estimatedHours: Number(chunk.estimatedHours) || 1,
                dueDate: targetDate.toISOString().split('T')[0],
                type: typeof chunk.type === 'string' ? chunk.type : 'assignment',
              };
            });
          }
          // Remove the raw JSON block from the text response
          textResponse =
            textResponse.slice(0, startIndex).trim() +
            '\n' +
            textResponse.slice(endIndex + endTag.length).trim();
        } catch (err) {
          console.warn('Failed to parse suggested chunks JSON from AI:', err);
        }
      }

      return NextResponse.json({
        reply: textResponse || generateOfflineSyllabusAnswer(body).reply,
        citations: [`[${body.courseCode || 'Course'} Syllabus]`],
        suggestedChunks: suggestedChunks.length > 0 ? suggestedChunks : undefined,
        suggestions: [
          'What is the late work policy?',
          'How are grades weighted?',
          'When are office hours?',
        ],
      });
    } catch (err) {
      console.warn('Anthropic call failed in syllabus chat, falling back to local engine:', err);
    }
  }

  // Deterministic offline syllabus reasoning engine fallback
  const offlineResult = generateOfflineSyllabusAnswer(body);
  return NextResponse.json(offlineResult);
}
