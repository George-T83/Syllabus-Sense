/**
 * Centralized AI Model Registry for Syllabus Sense.
 * Enforces single source of truth for model identifiers across all API routes,
 * extraction pipelines, and fallback routines with TypeScript strictness.
 */

export const AI_MODELS = {
  /** Primary model for structured multi-part syllabus extraction */
  SYLLABUS_EXTRACTION: process.env.SYLLABUS_EXTRACTION_MODEL || 'claude-sonnet-5',

  /** Model for interactive AI Copilot chat & contextual Q&A */
  SYLLABUS_CHAT: process.env.SYLLABUS_CHAT_MODEL || 'claude-sonnet-5',

  /** Model for fast course summarization & note synthesis */
  COURSE_SUMMARIZATION: process.env.COURSE_SUMMARIZATION_MODEL || 'claude-sonnet-5',
} as const;

export type AIModelType = keyof typeof AI_MODELS;

/** Helper function to retrieve model identifier with safe fallback */
export function getAIModel(type: AIModelType): string {
  return AI_MODELS[type] || 'claude-sonnet-5';
}

/**
 * Safely extracts and parses delimited JSON or structured text content
 * from model outputs, preventing crashes on malformed/truncated output.
 */
export function safeParseDelimitedContent<T>(
  rawText: string,
  startDelimiter: string,
  endDelimiter: string,
  fallback: T,
): T {
  if (!rawText || typeof rawText !== 'string') return fallback;

  const startIdx = rawText.indexOf(startDelimiter);
  if (startIdx === -1) return fallback;

  const contentStart = startIdx + startDelimiter.length;
  const endIdx = rawText.indexOf(endDelimiter, contentStart);
  const extracted =
    endIdx !== -1 ? rawText.substring(contentStart, endIdx) : rawText.substring(contentStart);

  try {
    return JSON.parse(extracted.trim()) as T;
  } catch {
    return fallback;
  }
}
