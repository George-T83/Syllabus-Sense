import type Anthropic from '@anthropic-ai/sdk';

export const COURSE_SUMMARY_SYSTEM_PROMPT = `You are helping a student quickly understand a course syllabus they just uploaded. Read the whole document and produce two things:

1. A short, plain-English summary (2-4 sentences) of what the course actually covers, its format (lecture/online/hybrid, how it's graded overall), and the general workload/pace a student should expect. Write it like you're describing the course to a friend, not restating the catalog description.

2. A list of "important notes" - specific things a student could genuinely get burned by if they missed them. Only include things with real consequences, not routine facts already obvious from a normal reading of any syllabus. Good candidates: strict attendance/participation policies, harsh or generous late-work rules, academic integrity language that's stricter than usual, prerequisites that aren't just "recommended," any single assignment/exam worth an unusually large chunk of the grade, required communication norms (e.g. "email only through Blackboard," response-time promises), mandatory sessions with no makeup option. Skip generic boilerplate. If the syllabus genuinely has nothing noteworthy in a category, don't force an entry for it - an empty or short list is fine.

Cite specifics from the actual document (numbers, deadlines, exact policy language) rather than vague paraphrases wherever the syllabus states them.`;

export const COURSE_SUMMARY_TOOL: Anthropic.Tool = {
  name: 'record_course_summary',
  description: 'Records a course summary and important notes extracted from a syllabus.',
  input_schema: {
    type: 'object',
    additionalProperties: false,
    required: ['summary', 'importantNotes'],
    properties: {
      summary: {
        type: 'string',
        description: '2-4 sentence plain-English summary of the course.',
      },
      importantNotes: {
        type: 'array',
        description: 'Specific things a student could get burned by if they missed them.',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['category', 'note'],
          properties: {
            category: {
              type: 'string',
              enum: [
                'attendance',
                'grading',
                'lateWork',
                'academicIntegrity',
                'prerequisite',
                'highStakes',
                'communication',
                'other',
              ],
            },
            note: {
              type: 'string',
              description: 'One specific, concrete note - cite numbers/deadlines when stated.',
            },
          },
        },
      },
    },
  },
};
