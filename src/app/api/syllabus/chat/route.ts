import { NextRequest, NextResponse } from 'next/server';
import { verifyFirebaseIdToken } from '@/lib/auth/verifyFirebaseIdToken';
import { getAnthropicClient } from '@/lib/ai/anthropic';
import {
  generateOfflineSyllabusAnswer,
  type ChatRequestBody,
} from '@/lib/syllabus/chatEngine';

export const runtime = 'nodejs';
export const maxDuration = 60;

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

  // Check if Anthropic LLM is available
  const anthropic = getAnthropicClient();
  if (anthropic && process.env.ANTHROPIC_API_KEY) {
    try {
      const prompt = `You are the Syllabus Sense AI Study Copilot. You assist students by answering questions accurately based strictly on their syllabus.
Course Code: ${body.courseCode || 'General Course'}
Course Title: ${body.courseTitle || ''}
Instructor: ${body.instructor || ''}
Location: ${body.location || ''}
Materials: ${body.materials?.join(', ') || 'Standard materials'}
Objectives: ${body.learningObjectives?.join('; ') || 'Standard course objectives'}
Syllabus Content Context:
${body.syllabusText || body.notes || 'Standard university syllabus structure with homework, exams, and attendance policies.'}

Student Query: ${body.message}

Format your answer with clear markdown headings, bullet points, and specific syllabus section citations in brackets (e.g. [Syllabus § 3 - Grading Policy]). Be concise, encouraging, and academically precise.`;

      const response = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      });

      const firstBlock = response.content[0];
      const textResponse = firstBlock && 'text' in firstBlock ? firstBlock.text : '';

      return NextResponse.json({
        reply: textResponse || generateOfflineSyllabusAnswer(body).reply,
        citations: [`[${body.courseCode || 'Course'} Syllabus]`],
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

  // Deterministic high-precision offline syllabus reasoning engine
  const offlineResult = generateOfflineSyllabusAnswer(body);
  return NextResponse.json(offlineResult);
}
