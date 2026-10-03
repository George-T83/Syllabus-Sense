// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockVerifyToken = vi.fn();
const mockExists = vi.fn();
const mockDownload = vi.fn();
const mockFile = vi.fn(() => ({ exists: mockExists, download: mockDownload }));

vi.mock('@/lib/auth/verifyFirebaseIdToken', () => ({
  verifyFirebaseIdToken: (...args: unknown[]) => mockVerifyToken(...args),
}));
vi.mock('@/lib/firebase/adminStorage', () => ({
  adminStorage: { bucket: () => ({ file: mockFile }) },
}));

import { GET } from '@/app/api/syllabus/file/route';

const PDF_BYTES = Buffer.from('%PDF-1.4\n%fake');
const HTML_BYTES = Buffer.from('<html><script>document.title="pwned"</script></html>');

function request(query: Record<string, string>, headers: Record<string, string> = {}) {
  const url = new URL('http://localhost:3000/api/syllabus/file');
  Object.entries(query).forEach(([k, v]) => url.searchParams.set(k, v));
  return new NextRequest(url, { headers });
}
const AUTH = { authorization: 'Bearer good-token' };

describe('/api/syllabus/file', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.FIREBASE_ADMIN_PROJECT_ID = 'test-project';
    mockVerifyToken.mockResolvedValue({ uid: 'u1' });
    mockExists.mockResolvedValue([true]);
    mockDownload.mockResolvedValue([PDF_BYTES]);
  });

  it('does not accept the ID token in the URL', async () => {
    const res = await GET(
      request({ path: 'users/u1/syllabi/c/a.pdf', name: 'a.pdf', token: 'good-token' }),
    );
    expect(res.status).toBe(401);
    expect(mockVerifyToken).not.toHaveBeenCalled();
  });

  it("refuses another user's file", async () => {
    const res = await GET(request({ path: 'users/u2/syllabi/c/a.pdf', name: 'a.pdf' }, AUTH));
    expect(res.status).toBe(403);
  });

  it('serves a real PDF inline with safe headers', async () => {
    const res = await GET(request({ path: 'users/u1/syllabi/c/a.pdf', name: 'a.pdf' }, AUTH));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/pdf');
    expect(res.headers.get('content-disposition')).toMatch(/^inline;/);
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('content-security-policy')).toBe("default-src 'none'; sandbox");
  });

  it('serves an uploaded HTML file as an opaque download, not as a page', async () => {
    mockDownload.mockResolvedValue([HTML_BYTES]);
    const res = await GET(
      request({ path: 'users/u1/syllabi/c/x.html', name: 'x.html', disposition: 'inline' }, AUTH),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/octet-stream');
    expect(res.headers.get('content-disposition')).toMatch(/^attachment;/);
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
  });

  it('ignores a content type the uploader set, and judges the bytes', async () => {
    // HTML bytes stored under a name that claims to be a PDF.
    mockDownload.mockResolvedValue([HTML_BYTES]);
    const res = await GET(
      request({ path: 'users/u1/syllabi/c/a.pdf', name: 'a.pdf', disposition: 'inline' }, AUTH),
    );
    expect(res.headers.get('content-type')).toBe('application/octet-stream');
    expect(res.headers.get('content-disposition')).toMatch(/^attachment;/);
  });
});
