import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

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
}));

import { POST, generateOfflineSyllabusAnswer } from '../route';

describe('AI Syllabus Chat Route (Item 35)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects requests with missing or invalid JSON body', async () => {
    const req = new NextRequest('http://localhost:3000/api/syllabus/chat', {
      method: 'POST',
      body: 'invalid-json',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('rejects requests with missing message parameter', async () => {
    const req = new NextRequest('http://localhost:3000/api/syllabus/chat', {
      method: 'POST',
      body: JSON.stringify({ courseCode: 'CS 301' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/Missing message/i);
  });

  it('generates accurate late policy answers and citations in offline mode', () => {
    const result = generateOfflineSyllabusAnswer({
      message: 'What is the late work policy for this class?',
      courseCode: 'CS 301',
      courseTitle: 'Data Structures',
      notes: 'Late work allowed with slip days.',
    });

    expect(result.reply).toContain('Late Submission Policy');
    expect(result.citations.length).toBeGreaterThan(0);
    expect(result.citations[0]).toContain('CS 301');
    expect(result.suggestions.length).toBeGreaterThan(0);
  });

  it('generates accurate grading breakdown answers in offline mode', () => {
    const result = generateOfflineSyllabusAnswer({
      message: 'How are grades and exams weighted?',
      courseCode: 'MATH 240',
      courseTitle: 'Linear Algebra',
    });

    expect(result.reply).toContain('Grading Breakdown');
    expect(result.reply).toContain('Final Exam');
    expect(result.citations[0]).toContain('MATH 240');
  });

  it('handles office hours and instructor queries accurately', () => {
    const result = generateOfflineSyllabusAnswer({
      message: 'When are the professor office hours?',
      courseCode: 'PHYS 202',
      instructor: 'Dr. Feynman',
      location: 'Science Hall 304',
    });

    expect(result.reply).toContain('Dr. Feynman');
    expect(result.reply).toContain('Office Hours');
    expect(result.citations[0]).toContain('Staff Information');
  });

  it('responds with status 200 and structured reply over POST endpoint', async () => {
    const req = new NextRequest('http://localhost:3000/api/syllabus/chat', {
      method: 'POST',
      body: JSON.stringify({
        message: 'What textbooks are required?',
        courseCode: 'CHEM 101',
        materials: ['Organic Chemistry 8th Edition', 'Molecular Model Kit'],
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.reply).toContain('Organic Chemistry 8th Edition');
    expect(data.citations.length).toBeGreaterThan(0);
  });
});
