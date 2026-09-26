// @vitest-environment node
//
// The route now imports aiUsageLimit.ts, which imports adminFirestore.ts -
// that throws if `window` is defined (firebase-admin must never load in
// client code), so this needs the real Node environment instead of the
// project's default jsdom.
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

import { POST } from '../route';
import { generateOfflineSyllabusAnswer } from '@/lib/syllabus/chatEngine';

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

  // Offline answers come only from what's on record. They used to invent
  // "typical" policies (a 25/25/35/15 grading split, "up to 2 unexcused
  // absences", Tue/Thu 2-4pm office hours) and cite them as the student's
  // own syllabus.
  const SYLLABUS = [
    'CS 301 - Data Structures',
    'Late work: 10% off per day, up to 3 days. No work accepted after solutions post.',
    'Grading: Homework 30%, Midterm 30%, Final 40%.',
    'Office hours: Mondays 1-3pm in Gates 204, or email chen@example.edu.',
  ].join('\n');

  it('quotes the late policy from the syllabus text, with a citation', () => {
    const result = generateOfflineSyllabusAnswer({
      message: 'What is the late work policy for this class?',
      courseCode: 'CS 301',
      syllabusText: SYLLABUS,
    });
    expect(result.reply).toContain('> Late work: 10% off per day, up to 3 days.');
    expect(result.reply).not.toContain('Grading:');
    expect(result.citations).toEqual(['[CS 301 Syllabus]']);
    expect(result.suggestions.length).toBeGreaterThan(0);
  });

  it('quotes the real grading weights and invents none', () => {
    const result = generateOfflineSyllabusAnswer({
      message: 'How are grades and exams weighted?',
      courseCode: 'CS 301',
      syllabusText: SYLLABUS,
    });
    expect(result.reply).toContain('Homework 30%, Midterm 30%, Final 40%');
    expect(result.reply).not.toMatch(/25%|35%|15%/);
    // Only the grading line - not the late policy's "10% off per day".
    expect(result.reply).not.toContain('Late work');
  });

  it('says so instead of guessing when there is no syllabus text', () => {
    const result = generateOfflineSyllabusAnswer({
      message: 'How are grades and exams weighted?',
      courseCode: 'MATH 240',
      courseTitle: 'Linear Algebra',
    });
    expect(result.reply).toMatch(/can't answer that without guessing/);
    expect(result.reply).toContain('no syllabus text saved for MATH 240');
    expect(result.reply).not.toMatch(/\d+%/);
    expect(result.citations).toEqual([]);
  });

  it('says the syllabus does not cover it rather than inventing a policy', () => {
    const result = generateOfflineSyllabusAnswer({
      message: 'How many classes can I miss?',
      courseCode: 'CS 301',
      instructor: 'Dr. Chen',
      syllabusText: SYLLABUS,
    });
    expect(result.reply).toMatch(/couldn't find anything about attendance/);
    expect(result.reply).toContain('Dr. Chen is the one to ask');
    expect(result.reply).not.toMatch(/unexcused absences/);
    expect(result.citations).toEqual([]);
  });

  it('answers contact questions from the saved instructor plus the syllabus lines', () => {
    const result = generateOfflineSyllabusAnswer({
      message: 'When are the professor office hours?',
      courseCode: 'CS 301',
      instructor: 'Dr. Chen',
      location: 'Gates 104',
      syllabusText: SYLLABUS,
    });
    expect(result.reply).toContain('**Instructor:** Dr. Chen');
    expect(result.reply).toContain('**Class location:** Gates 104');
    expect(result.reply).toContain('> Office hours: Mondays 1-3pm in Gates 204');
    expect(result.reply).not.toContain('Tuesdays & Thursdays');
  });

  it('lists saved materials without a syllabus citation', () => {
    const result = generateOfflineSyllabusAnswer({
      message: 'What textbooks are required?',
      courseCode: 'CHEM 101',
      materials: ['Organic Chemistry 8th Edition'],
    });
    expect(result.reply).toContain('- Organic Chemistry 8th Edition');
    expect(result.citations).toEqual([]);
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
    // Saved materials, not a syllabus quote - so no syllabus citation.
    expect(data.citations).toEqual([]);
  });
});
