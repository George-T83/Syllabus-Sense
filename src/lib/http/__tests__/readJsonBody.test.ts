// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { BodyTooLargeError, bodyErrorResponse, readJsonBody } from '../readJsonBody';

function request(body: BodyInit | null, headers: Record<string, string> = {}) {
  return new Request('http://localhost/api/x', { method: 'POST', body, headers });
}

/** A body delivered in chunks with no Content-Length, like a chunked upload. */
function chunked(chunks: string[]) {
  const enc = new TextEncoder();
  let i = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (i < chunks.length) controller.enqueue(enc.encode(chunks[i++]));
      else controller.close();
    },
  });
}

describe('readJsonBody', () => {
  it('parses a JSON body under the limit', async () => {
    expect(await readJsonBody(request('{"a":1}'), 100)).toEqual({ a: 1 });
  });

  it('accepts a body exactly at the limit', async () => {
    const body = '{"a":"xx"}';
    expect(await readJsonBody(request(body), body.length)).toEqual({ a: 'xx' });
  });

  it('refuses a declared Content-Length over the limit without reading the body', async () => {
    const req = new Request('http://localhost/x', {
      method: 'POST',
      body: 'x',
      headers: { 'content-length': '5000' },
    });
    const getReader = vi.spyOn(ReadableStream.prototype, 'getReader');
    await expect(readJsonBody(req, 100)).rejects.toBeInstanceOf(BodyTooLargeError);
    expect(getReader).not.toHaveBeenCalled();
    getReader.mockRestore();
  });

  it('stops reading a chunked body as soon as it passes the limit', async () => {
    let chunksRead = 0;
    const enc = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        chunksRead++;
        controller.enqueue(enc.encode('x'.repeat(40)));
        if (chunksRead > 1000) controller.close();
      },
    });
    const req = new Request('http://localhost/x', {
      method: 'POST',
      body: stream,
      // @ts-expect-error duplex is required for stream bodies in Node
      duplex: 'half',
    });
    await expect(readJsonBody(req, 100)).rejects.toBeInstanceOf(BodyTooLargeError);
    expect(chunksRead).toBeLessThan(10);
  });

  it('reassembles a chunked body that stays under the limit', async () => {
    const req = new Request('http://localhost/x', {
      method: 'POST',
      body: chunked(['{"msg":', '"hel', 'lo"}']),
      // @ts-expect-error duplex is required for stream bodies in Node
      duplex: 'half',
    });
    expect(await readJsonBody(req, 100)).toEqual({ msg: 'hello' });
  });

  it('throws a parse error for invalid or empty JSON', async () => {
    await expect(readJsonBody(request('not json'), 100)).rejects.toBeInstanceOf(SyntaxError);
    await expect(readJsonBody(request(null), 100)).rejects.toBeInstanceOf(SyntaxError);
  });
});

describe('bodyErrorResponse', () => {
  it('is a 413 for an oversized body', async () => {
    const res = bodyErrorResponse(new BodyTooLargeError(10), 'Invalid request body.');
    expect(res.status).toBe(413);
  });

  it('is a 400 with the route message for anything else', async () => {
    const res = bodyErrorResponse(new SyntaxError('x'), 'Invalid request body.');
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Invalid request body.');
  });
});
