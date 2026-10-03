import type { AdvisorReply } from '@/types/advisor';

/**
 * Questions the Advisor must never answer like a planning question, whether
 * the AI or the offline engine is behind it. These get a fixed, careful
 * reply and never reach the model.
 */
const CRISIS =
  /\b(?:kill(?:ing)? myself|end(?:ing)? (?:it all|my life)|suicid\w*|self[- ]?harm\w*|hurt(?:ing)? myself|want(?:ed)? to die|(?:don'?t|do not) want to (?:be here|live|be alive)|no reason to live|better off (?:dead|without me))\b/i;

const DISTRESS =
  /\b(?:can'?t cope|cannot cope|can'?t (?:go on|do this anymore|take (?:it|this) anymore)|panic attacks?|hopeless|depress(?:ed|ion)|burn(?:ed|t)[- ]?out|breaking down|having a breakdown|falling apart)\b/i;

const INTEGRITY =
  /\b(?:cheat(?:ing)?\b|plagiari[sz]\w*|fake (?:a |my |an )?(?:doctor'?s |medical )?(?:note|excuse|illness|sickness)|forg(?:e|ing) (?:a |my |an )?\w*\s?(?:note|signature|document)|(?:write|do) my (?:essay|paper|assignment|homework|lab report)|answers? (?:to|for) (?:the|my|tomorrow'?s) (?:exam|test|quiz|midterm|final)|get around (?:the )?proctor\w*|(?:buy|pay for) (?:an? )?(?:essay|paper))/i;

export type SensitiveTopic = 'crisis' | 'distress' | 'integrity';

export function detectSensitiveTopic(message: string): SensitiveTopic | null {
  if (CRISIS.test(message)) return 'crisis';
  if (INTEGRITY.test(message)) return 'integrity';
  if (DISTRESS.test(message)) return 'distress';
  return null;
}

const REPLIES: Record<SensitiveTopic, string> = {
  crisis:
    "I'm really sorry you're feeling this way, and I'm not the right help for it. If you might act on these thoughts or you're in danger right now, call your local emergency number. In the US you can call or text 988 (Suicide & Crisis Lifeline); findahelpline.com lists lines in other countries. Your campus counselling or health centre is there for exactly this, and so is anyone you trust. Telling one person tonight matters more than anything in your plan. Your grades and deadlines can wait.",
  distress:
    "That sounds like a lot to carry, and I'm glad you said it. I'm a planning tool, not a counsellor, so please reach out to your campus counselling or wellbeing service, or someone you trust. If the pressure is coming from deadlines, your instructors and your academic advisor can often arrange extensions or a lighter load, and it's much easier to ask before something is late.",
  integrity:
    "I can't help with cheating, plagiarism, or faking a note or an excuse, and getting caught can put your place in the program at risk. If you're behind or stuck, I can help in other ways: think through what to tackle first, plan study time, or work out what to say when you ask an instructor for an extension. Asking early and honestly usually goes better than people expect, and your school's tutoring or academic support office can help with the work itself.",
};

export function guardrailReply(message: string): AdvisorReply | null {
  const topic = detectSensitiveTopic(message);
  return topic ? { reply: REPLIES[topic] } : null;
}
