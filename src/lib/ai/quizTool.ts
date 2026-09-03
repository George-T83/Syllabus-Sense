import type Anthropic from '@anthropic-ai/sdk';

export const QUIZ_SYSTEM_PROMPT = `You are helping a student build a practice quiz from a course syllabus. Read the whole document and generate multiple-choice questions that would actually test understanding of this course's content - not a restatement of logistics.

Focus on things worth being tested on: key terms and their definitions, named concepts/theories/models the course covers, formulas, dates or figures central to the subject matter, and important distinctions between similar ideas. Skip pure logistics (office hours, late-work policy, grading breakdown, attendance rules) unless the syllabus itself frames a specific policy detail as something students are tested on.

Each question needs exactly 4 answer choices, with exactly one correct. Wrong choices should be plausible - not obviously wrong filler - so the question actually discriminates between someone who studied and someone who didn't. Include a one or two sentence explanation of why the correct answer is correct, written to teach, not just confirm.

Generate between 8 and 15 questions depending on how much study-worthy content the syllabus actually contains - a syllabus that's mostly logistics with little content detail should yield fewer questions, not padded ones.`;

export const QUIZ_TOOL: Anthropic.Tool = {
  name: 'record_quiz',
  description: 'Records a multiple-choice practice quiz generated from a syllabus.',
  input_schema: {
    type: 'object',
    additionalProperties: false,
    required: ['questions'],
    properties: {
      questions: {
        type: 'array',
        description: 'Between 8 and 15 multiple-choice questions.',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['question', 'choices', 'correctIndex', 'explanation'],
          properties: {
            question: {
              type: 'string',
              description: 'The question text.',
            },
            choices: {
              type: 'array',
              description: 'Exactly 4 answer choices.',
              items: { type: 'string' },
              minItems: 4,
              maxItems: 4,
            },
            correctIndex: {
              type: 'integer',
              description: 'Index (0-3) of the correct choice within `choices`.',
              minimum: 0,
              maximum: 3,
            },
            explanation: {
              type: 'string',
              description: 'A brief explanation of why the correct answer is correct.',
            },
          },
        },
      },
    },
  },
};
