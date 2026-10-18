// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockVerifyToken = vi.fn();
const mockCreate = vi.fn();
const mockGetMetadata = vi.fn();
const mockDownload = vi.fn();
const mockDelete = vi.fn();
const mockFile = vi.fn();
const storageState = { available: true };

vi.mock('@/lib/auth/verifyFirebaseIdToken', () => ({
  verifyFirebaseIdToken: (...args: unknown[]) => mockVerifyToken(...args),
}));
vi.mock('@/lib/ai/anthropic', () => ({
  getAnthropicClient: () => ({ messages: { create: (...a: unknown[]) => mockCreate(...a) } }),
  SYLLABUS_EXTRACTION_MODEL: 'test-model',
}));
vi.mock('@/lib/firebase/adminStorage', () => ({
  get adminStorage() {
    return storageState.available ? { bucket: () => ({ file: mockFile }) } : undefined;
  },
}));

import { POST } from '@/app/api/syllabus/extract/route';

const PDF_BYTES = Buffer.from('%PDF-1.4\nsample');
const MINE = 'users/u1/syllabi/_pending/abc-syllabus.pdf';

const call = (body: unknown) =>
  POST(
    new NextRequest('http://localhost:3000/api/syllabus/extract', {
      method: 'POST',
      headers: { Authorization: 'Bearer t', 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );

const good = {
  stop_reason: 'tool_use',
  content: [
    {
      type: 'tool_use',
      name: 'record_syllabus_extraction',
      input: {
        course: { code: 'CS101', title: 'Intro' },
        scheduleItems: [],
      },
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  storageState.available = true;
  process.env.FIREBASE_ADMIN_PROJECT_ID = 'test-project';
  mockVerifyToken.mockResolvedValue({ uid: 'u1' });
  mockFile.mockReturnValue({
    getMetadata: mockGetMetadata,
    download: mockDownload,
    delete: mockDelete,
  });
  mockGetMetadata.mockResolvedValue([{ size: String(PDF_BYTES.length) }]);
  mockDownload.mockResolvedValue([PDF_BYTES]);
  mockDelete.mockResolvedValue(undefined);
  mockCreate.mockResolvedValue(good);
});

describe('extract route: files sent by Storage path', () => {
  it('reads the file from Storage, sends it to the AI, and deletes the temporary copy', async () => {
    const res = await call({ storagePath: MINE, fileName: 'syllabus.pdf' });
    expect(res.status).toBe(200);
    expect(mockFile).toHaveBeenCalledWith(MINE);
    const sent = mockCreate.mock.calls[0][0].messages[0].content[0];
    expect(sent.source.data).toBe(PDF_BYTES.toString('base64'));
    expect(mockDelete).toHaveBeenCalledOnce();
  });

  it("refuses a path outside the student's own pending folder, without touching Storage", async () => {
    for (const p of ['users/u2/syllabi/_pending/x.pdf', 'users/u1/syllabi/course/x.pdf']) {
      const res = await call({ storagePath: p, fileName: 'x.pdf' });
      expect(res.status).toBe(403);
    }
    expect(mockFile).not.toHaveBeenCalled();
  });

  it('says so when large-file reading is not configured', async () => {
    storageState.available = false;
    const res = await call({ storagePath: MINE, fileName: 'syllabus.pdf' });
    expect(res.status).toBe(503);
    expect((await res.json()).error).toMatch(/Large file/);
  });

  it('rejects a stored file over 10MB and removes it', async () => {
    mockGetMetadata.mockResolvedValue([{ size: String(11 * 1024 * 1024) }]);
    const res = await call({ storagePath: MINE, fileName: 'syllabus.pdf' });
    expect(res.status).toBe(400);
    expect(mockDownload).not.toHaveBeenCalled();
    expect(mockDelete).toHaveBeenCalled();
  });

  it('reports a missing file as 404 with a next step', async () => {
    mockGetMetadata.mockRejectedValue(new Error('No such object'));
    const res = await call({ storagePath: MINE, fileName: 'syllabus.pdf' });
    expect(res.status).toBe(404);
    expect((await res.json()).error).toMatch(/uploading it again/);
  });

  it('still checks the real file type, not the name', async () => {
    mockDownload.mockResolvedValue([Buffer.from('plain text, not a pdf')]);
    const res = await call({ storagePath: MINE, fileName: 'syllabus.pdf' });
    expect(res.status).toBe(400);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('still accepts a small file sent inline', async () => {
    const res = await call({ fileBase64: PDF_BYTES.toString('base64'), fileName: 's.pdf' });
    expect(res.status).toBe(200);
    expect(mockFile).not.toHaveBeenCalled();
  });
});
