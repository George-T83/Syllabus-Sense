import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { __resetMemoryRateLimitStore } from '@/lib/security/rateLimit';

const mockVerifyToken = vi.fn();
const mockAnthropicCreate = vi.fn();

vi.mock('@/lib/auth/verifyFirebaseIdToken', () => ({
  verifyFirebaseIdToken: (...args: unknown[]) => mockVerifyToken(...args),
}));

vi.mock('@/lib/ai/anthropic', () => ({
  getAnthropicClient: () => ({
    messages: {
      create: (...args: unknown[]) => mockAnthropicCreate(...args),
    },
  }),
  SYLLABUS_EXTRACTION_MODEL: 'claude-3-7-sonnet-20250219',
}));

import { POST } from '@/app/api/syllabus/extract/route';

describe('/api/syllabus/extract route contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __resetMemoryRateLimitStore();
    process.env.FIREBASE_ADMIN_PROJECT_ID = 'test-project';
    mockVerifyToken.mockResolvedValue({ uid: 'user-123' });
  });

  it('rejects requests without authorization header with 401', async () => {
    const req = new NextRequest('http://localhost:3000/api/syllabus/extract', {
      method: 'POST',
      body: JSON.stringify({ fileBase64: 'JVBERi0xLjQK', fileName: 'test.pdf' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe('Unauthorized.');
  });

  it('rejects non-PDF and non-DOCX magic byte payloads with 400', async () => {
    const req = new NextRequest('http://localhost:3000/api/syllabus/extract', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer valid-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fileBase64: 'SGVsbG8gV29ybGQ=', fileName: 'test.txt' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain('not a valid PDF or Word');
  });

  it('CONTRACT: Returns parsed extraction result in memory without database mutations', async () => {
    mockAnthropicCreate.mockResolvedValueOnce({
      content: [
        {
          type: 'tool_use',
          name: 'record_syllabus_extraction',
          input: {
            course: {
              code: 'CS 101',
              title: 'Introduction to Computer Science',
              instructor: 'Prof. Alan Turing',
              term: 'Fall 2026',
              modality: 'in-person',
              meetingTimes: [
                { dayOfWeek: 2, startTime: '09:00', endTime: '10:15', location: 'Hall A' },
              ],
              materials: ['SICP Textbook'],
              skipDates: [],
              notes: 'Office hours by appointment',
              contacts: [],
              learningObjectives: ['Learn recursion and higher-order functions'],
            },
            scheduleItems: [
              {
                title: 'Problem Set 1',
                type: 'assignment',
                dueDate: '2026-09-10',
                dateConfidence: 'exact',
                gradeWeight: 5,
                gradeCategory: 'Homework',
                notes: 'Submit via GitHub',
                highStakes: false,
              },
            ],
            unresolved: [],
          },
        },
      ],
    });

    // Valid PDF magic bytes (%PDF- in base64 is JVBERi0)
    const pdfBase64 = 'JVBERi0xLjQKJcTl8uXrp/Og0MTGCjQgMCBvYmoKPDw...';
    const req = new NextRequest('http://localhost:3000/api/syllabus/extract', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer valid-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fileBase64: pdfBase64, fileName: 'cs101.pdf' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.result).toBeDefined();
    expect(json.result.course.code).toBe('CS 101');
    expect(json.result.scheduleItems).toHaveLength(1);
    expect(json.result.scheduleItems[0].title).toBe('Problem Set 1');
  });

  it('rate-limits a single account after 10 requests within a minute (429)', async () => {
    mockVerifyToken.mockResolvedValue({ uid: 'rate-limit-test-user' });
    const makeRequest = () =>
      new NextRequest('http://localhost:3000/api/syllabus/extract', {
        method: 'POST',
        headers: { Authorization: 'Bearer valid-token', 'Content-Type': 'application/json' },
        // Deliberately not a valid PDF/DOCX - the rate-limit check runs
        // before file-kind validation, so this only needs to exercise the
        // request count, not produce a successful extraction.
        body: JSON.stringify({ fileBase64: 'bm90LWEtcmVhbC1maWxl', fileName: 'x.txt' }),
      });

    for (let i = 0; i < 10; i++) {
      const res = await POST(makeRequest());
      expect(res.status).not.toBe(429);
    }

    const blockedRes = await POST(makeRequest());
    expect(blockedRes.status).toBe(429);
    expect(blockedRes.headers.get('Retry-After')).toBeTruthy();
    const json = await blockedRes.json();
    expect(json.error).toMatch(/too many requests/i);
  });
});
