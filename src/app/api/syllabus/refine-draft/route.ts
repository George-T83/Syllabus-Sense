import { NextRequest, NextResponse } from 'next/server';
import { BODY_LIMITS, bodyErrorResponse, readJsonBody } from '@/lib/http/readJsonBody';
import { requireUser } from '@/lib/auth/requireUser';
import { checkAndIncrementAiUsage } from '@/lib/ai/aiUsageLimit';
import { aiUsageDeniedResponse } from '@/lib/ai/usageResponse';
import { getAnthropicClient, SYLLABUS_EXTRACTION_MODEL } from '@/lib/ai/anthropic';
import {
  buildRefinePrompt,
  parseRefineResponse,
  OFFLINE_REFINE_REPLY,
  type RefineDraftFields,
  type RefineChatMessage,
} from '@/lib/syllabus/refineDraft';

export const runtime = 'nodejs';
export const maxDuration = 30;

interface RefineDraftRequestBody {
  draft: RefineDraftFields;
  message: string;
  history?: RefineChatMessage[];
}

const MAX_MESSAGE_CHARS = 2000;
/** Enough turns for the model to stay on-thread without the prompt growing
 * without bound as a chat runs long. */
const MAX_HISTORY_MESSAGES = 12;

export async function POST(req: NextRequest) {
  let body: RefineDraftRequestBody;
  try {
    body = await readJsonBody(req, BODY_LIMITS.text);
  } catch (err) {
    return bodyErrorResponse(err, 'Invalid JSON body.');
  }

  if (!body.message || typeof body.message !== 'string' || !body.message.trim()) {
    return NextResponse.json({ error: 'Missing message parameter.' }, { status: 400 });
  }
  if (!body.draft || typeof body.draft !== 'object') {
    return NextResponse.json({ error: 'Missing draft parameter.' }, { status: 400 });
  }

  const message = body.message.trim().slice(0, MAX_MESSAGE_CHARS);
  const history = Array.isArray(body.history) ? body.history.slice(-MAX_HISTORY_MESSAGES) : [];

  // Optional authentication check (graceful for demo/dev), same pattern as
  // this route's siblings in api/syllabus/*.
  const user = await requireUser(req);
  const isProd = process.env.NODE_ENV === 'production';
  if (isProd && !user && process.env.FIREBASE_ADMIN_PROJECT_ID) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  // An unauthenticated demo/dev call has no identity to cap per user, but it
  // still counts against the global daily AI budget.
  const usage = await checkAndIncrementAiUsage(user);
  if (!usage.allowed) {
    return aiUsageDeniedResponse(usage);
  }

  // getAnthropicClient throws without a key - check first, so a missing key
  // falls through to the honest offline reply below instead of a 500.
  const anthropic = process.env.ANTHROPIC_API_KEY ? getAnthropicClient() : null;
  if (anthropic) {
    try {
      const prompt = buildRefinePrompt(body.draft, history, message);
      const response = await anthropic.messages.create({
        model: SYLLABUS_EXTRACTION_MODEL,
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      });
      const block = response.content[0];
      const text = block && 'text' in block ? block.text : '';
      if (text.trim()) {
        return NextResponse.json(parseRefineResponse(text));
      }
    } catch (err) {
      console.warn(
        'Anthropic call failed in syllabus draft refine, falling back to offline reply:',
        err,
      );
    }
  }

  return NextResponse.json({ reply: OFFLINE_REFINE_REPLY });
}
