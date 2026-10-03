import { NextResponse } from 'next/server';

/** Largest JSON body each kind of route accepts, in bytes. */
export const BODY_LIMITS = {
  /** A route that takes a base64 file: 10 MB of file is ~13.4 MB of base64,
   * plus room for the other fields. */
  file: 14 * 1024 * 1024 + 256 * 1024,
  /** A chat-style route: a message, some history and a little context. */
  text: 256 * 1024,
  /** A route that only names a stored file. */
  small: 16 * 1024,
} as const;

export class BodyTooLargeError extends Error {
  constructor(public readonly maxBytes: number) {
    super(`Request body is larger than ${maxBytes} bytes.`);
    this.name = 'BodyTooLargeError';
  }
}

/**
 * Reads and parses a JSON request body, refusing anything over `maxBytes`.
 * A declared Content-Length over the limit is refused without reading
 * anything; otherwise the stream is read in chunks and cancelled as soon as
 * it passes the limit, so an oversized (or unbounded, chunked) body is never
 * held in memory in full. Throws BodyTooLargeError, or the JSON parse error.
 */
export async function readJsonBody<T>(req: Request, maxBytes: number): Promise<T> {
  const declared = Number(req.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) throw new BodyTooLargeError(maxBytes);

  const reader = req.body?.getReader();
  if (!reader) throw new SyntaxError('Empty request body.');

  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => {});
      throw new BodyTooLargeError(maxBytes);
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(bytes)) as T;
}

/** 413 for an oversized body, otherwise a 400 with the route's own message. */
export function bodyErrorResponse(err: unknown, invalidMessage: string) {
  if (err instanceof BodyTooLargeError) {
    return NextResponse.json({ error: 'That request is too large.' }, { status: 413 });
  }
  return NextResponse.json({ error: invalidMessage }, { status: 400 });
}
