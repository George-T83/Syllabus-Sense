import { NextRequest, NextResponse } from 'next/server';
import type Anthropic from '@anthropic-ai/sdk';
import { requireUser } from '@/lib/auth/requireUser';
import { checkAndIncrementAiUsage } from '@/lib/ai/aiUsageLimit';
import { getAnthropicClient, SYLLABUS_EXTRACTION_MODEL } from '@/lib/ai/anthropic';
import { buildAdvisorSystemPrompt, buildAdvisorTool } from '@/lib/ai/advisorTool';
import { buildAdvisorContextBlock, type AdvisorContextInput } from '@/lib/advisor/buildContext';
import { generateOfflineAdvisorReply } from '@/lib/advisor/offlineAdvisor';
import { advisorReplySchema } from '@/types/advisor';
import type { DegreeCourse, DegreeProfile } from '@/types/degreeCompass';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_HISTORY_TURNS = 8;

interface AdvisorChatRequestBody {
  message?: string;
  history?: { role: 'user' | 'assistant'; content: string }[];
  degreeProfile?: DegreeProfile | null;
  degreeCourses?: DegreeCourse[];
  courses?: { code: string; title?: string; term?: string }[];
  pendingTaskCount?: number;
  overdueTaskCount?: number;
}

/**
 * Reasons over the student's own already-loaded Degree Compass/course data
 * (sent by the client, same trust model as /api/syllabus/chat's syllabus
 * fields) rather than re-fetching from Firestore server-side - this route
 * never writes anything, so a client sending its own stale or edited copy
 * of its own data only affects the answer it gets back, not any other
 * user's data or the account's actual stored state.
 */
export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  let body: AdvisorChatRequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  if (!body.message || typeof body.message !== 'string') {
    return NextResponse.json({ error: 'Missing message parameter.' }, { status: 400 });
  }

  const usage = await checkAndIncrementAiUsage(user);
  if (!usage.allowed) {
    return NextResponse.json(
      { error: `Daily AI usage limit reached (${usage.limit} requests/day). Try again tomorrow.` },
      { status: 429 },
    );
  }

  const contextInput: AdvisorContextInput = {
    degreeProfile: body.degreeProfile ?? null,
    degreeCourses: body.degreeCourses ?? [],
    courses: body.courses ?? [],
    pendingTaskCount: body.pendingTaskCount ?? 0,
    overdueTaskCount: body.overdueTaskCount ?? 0,
  };

  let anthropic;
  try {
    anthropic = getAnthropicClient();
  } catch {
    return NextResponse.json(generateOfflineAdvisorReply(body.message, contextInput));
  }

  const contextBlock = buildAdvisorContextBlock(contextInput);
  const tool = buildAdvisorTool();
  const history = (body.history ?? []).slice(-MAX_HISTORY_TURNS);
  const messages: Anthropic.MessageParam[] = [
    ...history.map(
      (turn) => ({ role: turn.role, content: turn.content }) as Anthropic.MessageParam,
    ),
    { role: 'user' as const, content: body.message },
  ];

  try {
    const response = await anthropic.messages.create({
      model: SYLLABUS_EXTRACTION_MODEL,
      max_tokens: 1024,
      system: buildAdvisorSystemPrompt(contextBlock),
      tools: [tool],
      tool_choice: { type: 'tool', name: tool.name },
      messages,
    });

    const toolUse = response.content.find(
      (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use',
    );
    if (!toolUse) {
      return NextResponse.json(
        { error: 'The Advisor did not return a structured reply. Try again.' },
        { status: 502 },
      );
    }

    const parsed = advisorReplySchema.safeParse(toolUse.input);
    if (!parsed.success) {
      console.error('Advisor reply validation failed:', parsed.error.issues);
      return NextResponse.json(
        { error: 'The Advisor returned a malformed reply. Try again.' },
        { status: 502 },
      );
    }

    return NextResponse.json(parsed.data);
  } catch (err) {
    console.warn('Anthropic call failed in advisor chat, falling back to offline engine:', err);
    return NextResponse.json(generateOfflineAdvisorReply(body.message, contextInput));
  }
}
