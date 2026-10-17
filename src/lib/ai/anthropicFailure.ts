import Anthropic from '@anthropic-ai/sdk';

/**
 * What to tell our own client when a call to the AI provider fails. The
 * provider's status is not ours to pass through: its 429 means *it* is busy,
 * which our client would read as "you used today's requests", and its 401 means
 * our key is wrong, which is nothing a student can act on.
 */
export interface ProviderFailure {
  /** The status to answer our client with. */
  status: number;
  /** Safe to show: no provider or account detail. */
  error: string;
  /** Seconds to wait, when the provider said so. */
  retryAfter?: number;
}

export const SYLLABUS_TOO_LONG_MESSAGE =
  'This syllabus is longer than the AI can read in one pass.';

export function describeProviderFailure(err: unknown): ProviderFailure {
  if (err instanceof Anthropic.APIConnectionTimeoutError) {
    return { status: 504, error: 'The AI service took too long to answer.' };
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return { status: 502, error: 'Extraction request failed.' };
  }
  if (err instanceof Anthropic.APIError) {
    const status = err.status;
    const message = typeof err.message === 'string' ? err.message : '';
    if (status === 429 || status === 529 || status === 503) {
      const header = err.headers?.get?.('retry-after');
      const retryAfter = header ? Number(header) : NaN;
      return {
        status: 503,
        error: 'The AI service is busy right now. Try again in a minute.',
        ...(Number.isFinite(retryAfter) && retryAfter > 0 ? { retryAfter } : {}),
      };
    }
    if (status === 401 || status === 403 || status === 404) {
      return { status: 503, error: 'Syllabus extraction is not configured on the server.' };
    }
    if (status === 400 || status === 413) {
      // A document over the provider's length or page limit.
      if (/too long|too large|exceeds|maximum|pages?/i.test(message)) {
        return { status: 422, error: SYLLABUS_TOO_LONG_MESSAGE };
      }
    }
  }
  return { status: 502, error: 'Extraction request failed.' };
}
