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
  SYLLABUS_EXTRACTION_MODEL: 'claude-sonnet-5',
}));

import { POST } from '../route';

describe('AI Syllabus Chat - Rubric Ingestion & Suggested Chunks Extraction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ANTHROPIC_API_KEY = 'test-api-key';
  });

  it('correctly processes and extracts suggested chunks block from Claude response', async () => {
    const mockClaudeReply = `Here is a guide to chunking your Final Project:

First, make sure you outline your architecture.
Second, implement the database and auth layers.

---SUGGESTED_CHUNKS_START---
[
  {
    "title": "Setup outline & initial schema",
    "notes": "Define tables and draft relationships from rubric page 2",
    "estimatedHours": 2,
    "dueDateOffsetDays": 3,
    "type": "project"
  },
  {
    "title": "Implement authentication endpoints",
    "notes": "Integrate Firebase auth verify token logic",
    "estimatedHours": 3.5,
    "dueDateOffsetDays": 5,
    "type": "coding"
  }
]
---SUGGESTED_CHUNKS_END---

Let me know if you need help with anything else!`;

    mockAnthropicCreate.mockResolvedValue({
      content: [{ type: 'text', text: mockClaudeReply }],
    });

    const req = new NextRequest('http://localhost:3000/api/syllabus/chat', {
      method: 'POST',
      body: JSON.stringify({
        message: 'Help me plan my project chunks from this rubric',
        courseCode: 'CSCI 313',
        fileBase64: 'JVBERi0tLS10ZXN0LXBkZi1maWxlLWNvbnRlbnQtYmFzZTY0', // PDF magic bytes
        fileName: 'project-rubric.pdf',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const data = await res.json();

    // Reply must NOT contain the raw JSON tags or content block
    expect(data.reply).not.toContain('---SUGGESTED_CHUNKS_START---');
    expect(data.reply).not.toContain('---SUGGESTED_CHUNKS_END---');
    expect(data.reply).toContain('Here is a guide to chunking your Final Project:');
    expect(data.reply).toContain('Let me know if you need help');

    // Chunks must be correctly parsed and formatted
    expect(data.suggestedChunks).toBeDefined();
    expect(data.suggestedChunks.length).toBe(2);

    const firstChunk = data.suggestedChunks[0];
    expect(firstChunk.title).toBe('Setup outline & initial schema');
    expect(firstChunk.estimatedHours).toBe(2);
    expect(firstChunk.type).toBe('project');

    // Offset days (3) must be resolved to a future YYYY-MM-DD date string
    const expectedDate = new Date();
    expectedDate.setDate(expectedDate.getDate() + 3);
    const expectedDateStr = expectedDate.toISOString().split('T')[0];
    expect(firstChunk.dueDate).toBe(expectedDateStr);

    const secondChunk = data.suggestedChunks[1];
    expect(secondChunk.title).toBe('Implement authentication endpoints');
    expect(secondChunk.estimatedHours).toBe(3.5);
    expect(secondChunk.type).toBe('coding');
  });

  it('never leaks a raw, truncated chunks block into the reply when the model hits max_tokens mid-JSON', async () => {
    // Simulates a response cut off by max_tokens before the closing tag -
    // a real failure mode observed with a large rubric: the model emits the
    // start tag and partial JSON, then the response just stops.
    const truncatedReply = `Here is your study plan:

---SUGGESTED_CHUNKS_START---
[
  {
    "title": "Setup outline & initial schema",
    "notes": "Define tables and draft relationships from rubric page 2",
    "estimatedHours": 2,
    "dueDateOffsetDays": 3,
    "type": "project"
  },
  {
    "title": "Implement authentication end`;

    mockAnthropicCreate.mockResolvedValue({
      content: [{ type: 'text', text: truncatedReply }],
    });

    const req = new NextRequest('http://localhost:3000/api/syllabus/chat', {
      method: 'POST',
      body: JSON.stringify({
        message: 'Break this rubric into subtasks',
        courseCode: 'CSCI 313',
        fileBase64: 'JVBERi0tLS10ZXN0LXBkZi1maWxlLWNvbnRlbnQtYmFzZTY0',
        fileName: 'project-rubric.pdf',
      }),
    });

    const res = await POST(req);
    const data = await res.json();

    // The dangling tag and partial JSON must never reach the user, even
    // though there's no closing tag to bound the extraction with.
    expect(data.reply).not.toContain('---SUGGESTED_CHUNKS_START---');
    expect(data.reply).not.toContain('"title"');
    expect(data.reply).toContain('Here is your study plan:');
    // An incomplete block can't be safely parsed - no chunks this turn,
    // not a best-effort guess at the model's cut-off JSON.
    expect(data.suggestedChunks).toBeUndefined();
  });
});
