import { describe, it, expect } from 'vitest';
import {
  AiRequestError,
  aiRequestErrorFrom,
  classifyAiFailure,
  describeAiFailure,
} from '../requestFailure';

const failure = (status: number, serverMessage: string | null = null) =>
  new AiRequestError(status, serverMessage);

describe('classifyAiFailure', () => {
  it.each([
    [401, 'signed_out'],
    [403, 'signed_out'],
    [413, 'file_too_large'],
    [429, 'rate_limited'],
    [400, 'invalid_file'],
    [404, 'invalid_file'],
    [422, 'invalid_file'],
    [503, 'unavailable'],
    [502, 'service_error'],
    [504, 'service_error'],
    [500, 'server_error'],
    [507, 'server_error'],
    [418, 'unexpected'],
  ])('maps HTTP %i to %s', (status, kind) => {
    expect(classifyAiFailure(failure(status))).toBe(kind);
  });

  it('treats a 400 that says the file is too large as too large', () => {
    expect(classifyAiFailure(failure(400, 'File is too large (max 10MB).'))).toBe('file_too_large');
  });

  it('treats a fetch rejection (TypeError) as offline', () => {
    expect(classifyAiFailure(new TypeError('Failed to fetch'))).toBe('offline');
  });

  it('treats the not-signed-in error as signed out', () => {
    expect(classifyAiFailure(new Error('You must be signed in.'))).toBe('signed_out');
  });

  it('treats any other error (a malformed AI answer, say) as unexpected', () => {
    expect(classifyAiFailure(new Error('Unexpected token < in JSON'))).toBe('unexpected');
    expect(classifyAiFailure('weird')).toBe('unexpected');
  });
});

describe('describeAiFailure', () => {
  it('never shows the raw browser or server text', () => {
    const copy = [
      describeAiFailure(new TypeError('Failed to fetch')).message,
      describeAiFailure(new SyntaxError('Unexpected token \'<\', "<html>" is not valid JSON'))
        .message,
      describeAiFailure(failure(502, 'Extraction request failed.')).message,
      describeAiFailure(failure(500, 'TypeError: cannot read properties of undefined')).message,
    ].join(' ');
    expect(copy).not.toMatch(
      /Failed to fetch|Unexpected token|Extraction request failed|TypeError/,
    );
  });

  it('only says the file could not be read when the file is the problem', () => {
    const fileProblem = /file couldn't be used|too large/i;
    expect(describeAiFailure(failure(400)).message).toMatch(fileProblem);
    for (const status of [401, 429, 500, 502, 503]) {
      expect(describeAiFailure(failure(status)).message).not.toMatch(
        /couldn't be read|read that file/i,
      );
      expect(describeAiFailure(failure(status)).message).not.toMatch(fileProblem);
    }
    expect(describeAiFailure(new TypeError('x')).message).not.toMatch(fileProblem);
  });

  it('gives each failure its own wording', () => {
    const kinds = [
      new TypeError('x'),
      failure(401),
      failure(400),
      failure(413),
      failure(429),
      failure(503),
      failure(502),
      failure(500),
      new Error('x'),
    ].map((e) => describeAiFailure(e).message);
    expect(new Set(kinds).size).toBe(kinds.length);
  });

  it('shows a vetted server message for a bad file, because it was written for the student', () => {
    expect(describeAiFailure(failure(400, 'That document appears to be empty.')).message).toBe(
      'That document appears to be empty.',
    );
    expect(
      describeAiFailure(failure(400, 'That file is not a valid PDF or Word (.docx) document.'))
        .message,
    ).toMatch(/not a valid PDF or Word/);
  });

  it('does not show an unvetted 400 message', () => {
    expect(describeAiFailure(failure(400, 'Invalid request body.')).message).not.toMatch(
      /Invalid request body/,
    );
    expect(describeAiFailure(failure(400, 'Missing storagePath or fileName.')).message).not.toMatch(
      /Missing/,
    );
  });

  it('marks failures where retrying the same request cannot help', () => {
    expect(describeAiFailure(failure(400)).retryable).toBe(false);
    expect(describeAiFailure(failure(413)).retryable).toBe(false);
    expect(describeAiFailure(failure(429)).retryable).toBe(false);
    expect(describeAiFailure(failure(401)).retryable).toBe(false);
    expect(describeAiFailure(failure(502)).retryable).toBe(true);
    expect(describeAiFailure(failure(503)).retryable).toBe(true);
    expect(describeAiFailure(new TypeError('x')).retryable).toBe(true);
  });
});

describe('aiRequestErrorFrom', () => {
  it('reads the status and the JSON error string', async () => {
    const err = await aiRequestErrorFrom(
      new Response(JSON.stringify({ error: 'Daily AI usage limit reached.' }), { status: 429 }),
    );
    expect(err.status).toBe(429);
    expect(err.serverMessage).toBe('Daily AI usage limit reached.');
  });

  it('copes with an HTML error page instead of JSON', async () => {
    const err = await aiRequestErrorFrom(
      new Response('<html><body>Bad Gateway</body></html>', { status: 502 }),
    );
    expect(err.status).toBe(502);
    expect(err.serverMessage).toBeNull();
    expect(classifyAiFailure(err)).toBe('service_error');
  });

  it('copes with an empty body and with JSON that has no error string', async () => {
    expect(
      (await aiRequestErrorFrom(new Response(null, { status: 413 }))).serverMessage,
    ).toBeNull();
    expect(
      (await aiRequestErrorFrom(new Response('{"a":1}', { status: 500 }))).serverMessage,
    ).toBeNull();
    expect(
      (await aiRequestErrorFrom(new Response('{"error":42}', { status: 500 }))).serverMessage,
    ).toBeNull();
  });
});
