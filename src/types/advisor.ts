import { z } from 'zod';

/**
 * Surfaced when the Advisor's answer touches a high-stakes decision (drops
 * the student below full-time, a graduation-requirement window, a
 * prerequisite chain, or the Advisor's own low confidence) - kept as a
 * separate, structured field rather than baked into `content` so the UI can
 * render it as its own warning card instead of relying on the model to
 * format a callout consistently in prose every time.
 */
export interface AdvisorWarning {
  /** Short label, e.g. "Drops you below full-time". */
  reason: string;
  /** One or two sentence explanation of the risk. */
  detail: string;
}

export type AdvisorRole = 'user' | 'assistant';

export interface AdvisorMessage {
  id: string;
  role: AdvisorRole;
  content: string;
  warning?: AdvisorWarning;
  createdAt: string;
}

export const advisorWarningSchema = z.object({
  reason: z.string().min(1),
  detail: z.string().min(1),
});

export const advisorReplySchema = z.object({
  reply: z.string().min(1),
  highStakes: advisorWarningSchema.optional(),
});

export type AdvisorReply = z.infer<typeof advisorReplySchema>;
