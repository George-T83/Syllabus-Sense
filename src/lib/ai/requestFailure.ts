/**
 * Turns a failed call to one of the AI routes into honest, specific copy.
 *
 * Every AI feature used to show whatever message happened to be on the error:
 * the fixed string "Couldn't read that file" for every failure of the
 * extraction request (a server error and a rate limit included), and raw
 * strings such as "Failed to fetch" or "Unexpected token '<'" from the
 * browser. A student who hit a busy server concluded their file was bad.
 *
 * This file is client-safe: it has no server imports.
 */

export type AiFailureKind =
  | 'offline'
  | 'signed_out'
  | 'invalid_file'
  | 'file_too_large'
  | 'rate_limited'
  | 'unavailable'
  | 'service_error'
  | 'server_error'
  | 'unexpected';

/** A non-2xx answer from an AI route. */
export class AiRequestError extends Error {
  readonly status: number;
  /** The route's own `error` string, when the body was JSON with one. Never
   * shown as-is (see `describeAiFailure`); kept for logging. */
  readonly serverMessage: string | null;

  constructor(status: number, serverMessage: string | null) {
    super(`AI request failed with status ${status}`);
    this.name = 'AiRequestError';
    this.status = status;
    this.serverMessage = serverMessage;
  }
}

/**
 * Builds the error for a failed Response without assuming the body is JSON:
 * a platform-level 413 or 502 is plain text or HTML, and parsing that as JSON
 * is what used to leak "Unexpected token '<'" to the student.
 */
export async function aiRequestErrorFrom(res: Response): Promise<AiRequestError> {
  let serverMessage: string | null = null;
  try {
    const body: unknown = await res.json();
    if (body && typeof body === 'object' && 'error' in body) {
      const value = (body as { error?: unknown }).error;
      if (typeof value === 'string') serverMessage = value;
    }
  } catch {
    // Not JSON: the status alone decides the copy.
  }
  return new AiRequestError(res.status, serverMessage);
}

/** Server 400 messages that were written for the student and are safe to show. */
const SAFE_FILE_MESSAGES: RegExp[] = [
  /appears to be empty/i,
  /not a valid PDF or Word/i,
  /Couldn.t read that Word document/i,
  /too large \(max/i,
];

export function classifyAiFailure(err: unknown): AiFailureKind {
  if (err instanceof AiRequestError) {
    const { status } = err;
    if (status === 401 || status === 403) return 'signed_out';
    if (status === 413) return 'file_too_large';
    if (status === 429) return 'rate_limited';
    if (status === 400 || status === 404 || status === 422) {
      return err.serverMessage && /too large/i.test(err.serverMessage)
        ? 'file_too_large'
        : 'invalid_file';
    }
    if (status === 503) return 'unavailable';
    if (status === 502 || status === 504) return 'service_error';
    if (status >= 500) return 'server_error';
    return 'unexpected';
  }
  // fetch() rejects with a TypeError on a genuine network failure.
  if (err instanceof TypeError) return 'offline';
  if (err instanceof Error && err.message === 'You must be signed in.') return 'signed_out';
  return 'unexpected';
}

const COPY: Record<AiFailureKind, string> = {
  offline: "Couldn't reach the server. Check your connection and try again.",
  signed_out: "You've been signed out. Sign in again, then retry.",
  invalid_file: "That file couldn't be used. Try a different PDF or Word (.docx) file.",
  file_too_large: 'That file is too large to upload (10 MB max). Try a smaller one.',
  rate_limited: "You've used today's AI requests. They reset tomorrow, so try again then.",
  unavailable: "AI features aren't available right now. Try again later.",
  service_error:
    "The AI service had a problem and couldn't finish. Your file is fine, so try again in a moment.",
  server_error: 'Something went wrong on our side. Try again in a moment.',
  unexpected: 'Something went wrong. Try again.',
};

export interface AiFailure {
  kind: AiFailureKind;
  message: string;
  /** Trying the same request again might work. */
  retryable: boolean;
}

/** The copy to show for any error thrown while calling an AI route. */
export function describeAiFailure(err: unknown): AiFailure {
  const kind = classifyAiFailure(err);
  let message = COPY[kind];
  if (
    kind === 'invalid_file' &&
    err instanceof AiRequestError &&
    err.serverMessage &&
    SAFE_FILE_MESSAGES.some((p) => p.test(err.serverMessage as string))
  ) {
    message = err.serverMessage;
  }
  return {
    kind,
    message,
    retryable: !['invalid_file', 'file_too_large', 'rate_limited', 'signed_out'].includes(kind),
  };
}
