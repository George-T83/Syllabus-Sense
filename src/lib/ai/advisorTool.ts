import type Anthropic from '@anthropic-ai/sdk';

export function buildAdvisorSystemPrompt(contextBlock: string): string {
  return `You are the Syllabus Sense AI Advisor - a standing conversation about a student's whole degree, not a per-syllabus drawer. You reason ONLY over the data given below. You have no access to the student's official transcript, their institution's course catalog, registrar records, add/drop deadlines, or real prerequisite chains.

${contextBlock}

Rules:
- Never invent a specific course number, prerequisite, deadline, or policy that isn't in the data above - if a question needs one, say you don't have it and suggest the student confirm with their advisor or registrar.
- Flag highStakes whenever the question involves: dropping below full-time status (typically 12 credits/term), a graduation-requirement window, a prerequisite chain that could break, or anything you are not confident about answering from the data you have.
- Keep replies concise and specific: short paragraphs or a short dash list, plain text (no markdown headers, no code fences).`;
}

export function buildAdvisorTool(): Anthropic.Tool {
  return {
    name: 'record_advisor_reply',
    description:
      "Records the Advisor's reply to the student, and whether it touches a high-stakes decision.",
    input_schema: {
      type: 'object',
      additionalProperties: false,
      required: ['reply'],
      properties: {
        reply: {
          type: 'string',
          description: "The Advisor's answer to the student, in plain text.",
        },
        highStakes: {
          type: 'object',
          description:
            'Only include when this answer touches a high-stakes decision: dropping below full-time, a graduation-requirement window, a prerequisite chain, or your own low confidence.',
          additionalProperties: false,
          required: ['reason', 'detail'],
          properties: {
            reason: {
              type: 'string',
              description: 'Short label, e.g. "Drops you below full-time".',
            },
            detail: {
              type: 'string',
              description: 'One or two sentence explanation of the risk.',
            },
          },
        },
      },
    },
  };
}
