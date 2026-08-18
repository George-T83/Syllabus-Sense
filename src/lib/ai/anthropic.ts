/**
 * Server-only Anthropic client. Never import this from client components -
 * it reads ANTHROPIC_API_KEY directly and would leak the key into the
 * client bundle.
 */
import Anthropic from '@anthropic-ai/sdk';

if (typeof window !== 'undefined') {
  throw new Error('Internal Error: lib/ai/anthropic must not be imported in client-side code.');
}

let client: Anthropic | undefined;

export function getAnthropicClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not configured.');
  }
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

/** Latest, most capable Claude model - syllabus extraction benefits from
 * strong document understanding and instruction-following on an unusual,
 * multi-part JSON schema. */
export const SYLLABUS_EXTRACTION_MODEL = 'claude-sonnet-5';
