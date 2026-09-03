import type Anthropic from '@anthropic-ai/sdk';

export function buildCramPlanSystemPrompt(examTitle: string, days: number): string {
  return `You are helping a student build a day-by-day review plan for an upcoming exam, from their course syllabus.

The exam is "${examTitle}". The student has ${days} day${days === 1 ? '' : 's'} left before it, starting today. Read the whole syllabus and produce exactly ${days} topics - one per day, in the order they should be reviewed, ending with the most integrative or highest-value review on the final day (the day of or right before the exam).

Base the topics on what the syllabus says this exam actually covers (a stated exam scope, unit/module breakdown, or the general course content if no explicit scope is given). Each topic should be specific enough to act on - "Review eigenvalues and diagonalization" rather than "Review chapter 5" - and sized for roughly one day of focused review, not the whole course crammed into one line. Don't repeat the same topic on multiple days; if there's more content than ${days} days can cover, group related sub-topics into a single day's line rather than dropping days.

Return exactly ${days} topics, no more and no fewer.`;
}

export function buildCramPlanTool(days: number): Anthropic.Tool {
  return {
    name: 'record_cram_plan',
    description: `Records a ${days}-day exam review plan, one topic per day.`,
    input_schema: {
      type: 'object',
      additionalProperties: false,
      required: ['topics'],
      properties: {
        topics: {
          type: 'array',
          description: `Exactly ${days} review topics, one per day, in order.`,
          items: { type: 'string' },
          minItems: days,
          maxItems: days,
        },
      },
    },
  };
}
