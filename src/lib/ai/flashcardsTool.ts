import type Anthropic from '@anthropic-ai/sdk';

export const FLASHCARDS_SYSTEM_PROMPT = `You are helping a student turn a course syllabus into study flashcards. Read the whole document and generate flashcards that would actually help someone study for this course - not a restatement of logistics.

Focus on things worth memorizing or being able to explain: key terms and their definitions, named concepts/theories/models the course covers, formulas, dates or figures central to the subject matter, and important distinctions between similar ideas. Skip pure logistics that don't belong on a study card (office hours, late-work policy, grading breakdown, attendance rules) unless the syllabus itself frames a specific policy detail as something students are tested on.

Write each card as a genuine question-and-answer or term-and-definition pair, not a fragment of the syllabus text pasted verbatim. The front should be answerable from memory; the back should be a complete, standalone answer.

Generate between 8 and 20 cards depending on how much study-worthy content the syllabus actually contains - a syllabus that's mostly logistics with little content detail should yield fewer cards, not padded ones.`;

export const FLASHCARDS_TOOL: Anthropic.Tool = {
  name: 'record_flashcards',
  description: 'Records a set of study flashcards generated from a syllabus.',
  input_schema: {
    type: 'object',
    additionalProperties: false,
    required: ['cards'],
    properties: {
      cards: {
        type: 'array',
        description: 'Between 8 and 20 flashcards, each a genuine question/term and answer pair.',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['front', 'back'],
          properties: {
            front: {
              type: 'string',
              description: 'The question or term shown first - what the student tries to recall.',
            },
            back: {
              type: 'string',
              description: 'The complete answer or definition.',
            },
          },
        },
      },
    },
  },
};
