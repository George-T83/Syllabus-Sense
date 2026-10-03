import { computeCategoryProgress, computeOverallProgress } from '@/lib/degreeCompass/progress';
import type { AdvisorReply } from '@/types/advisor';
import type { AdvisorContextInput } from './buildContext';

/**
 * Deterministic fallback for when ANTHROPIC_API_KEY isn't configured (local
 * dev, emulator-only setups) - same role as generateOfflineSyllabusAnswer
 * for the syllabus chat. Reasons over the same real data the AI path would,
 * just with keyword matching instead of a model, so the Advisor is still
 * genuinely useful with zero external dependencies.
 */
export function generateOfflineAdvisorReply(
  message: string,
  input: AdvisorContextInput,
): AdvisorReply {
  return { ...answer(message, input), offline: true };
}

// Whole-word matches: plain substring tests treated "backdrop" as a drop
// question and "space" as a pace question.
const DROP =
  /\b(?:drop(?:s|ped|ping)?|withdraw(?:s|n|al|als|ing)?|withdrew)\b(?!-?\s?(?:down|box))/;
const ON_TRACK = /\b(?:track|graduat\w*|pace|on time)\b/;
const NEXT_TERM = /\b(?:next (?:semester|term)|take next|what should i take)\b/;

function answer(message: string, input: AdvisorContextInput): AdvisorReply {
  const q = message.toLowerCase();
  const { degreeProfile, degreeCourses } = input;

  // A drop/withdraw question is flagged high-stakes unconditionally - this
  // engine has no registrar data (add/drop deadlines, prerequisite chains),
  // so it can never rule out the risk, only warn about it.
  if (DROP.test(q)) {
    return {
      reply:
        "Dropping or withdrawing from a course can affect your full-time status, a prerequisite chain, or your graduation timeline - I don't have access to your official enrollment, add/drop deadlines, or your program's specific prerequisite rules, so I can't confirm what this would actually do. Check with your academic advisor before making the change.",
      highStakes: {
        reason: 'High-stakes decision detected',
        detail:
          "I can't verify enrollment status, prerequisite chains, or add/drop deadlines from your saved data - confirm with your advisor before dropping a course.",
      },
    };
  }

  if (!degreeProfile) {
    return {
      reply:
        'You haven\'t set up Degree Compass yet, so I can\'t reason about your overall degree progress or graduation timeline. Set it up from the Degree page and I\'ll be able to answer questions like "what should I take next" or "am I on track to graduate."',
    };
  }

  const overall = computeOverallProgress(degreeProfile.categories, degreeCourses);
  const earnedCredits = overall.creditsCompleted + overall.creditsInProgress;
  const pct = overall.creditsRequired
    ? Math.round((earnedCredits / overall.creditsRequired) * 100)
    : 0;
  const completedTerms = new Set(
    degreeCourses.filter((c) => c.status === 'completed').map((c) => c.term),
  ).size;

  if (ON_TRACK.test(q)) {
    const perTerm = completedTerms > 0 ? earnedCredits / completedTerms : 0;
    const termsRemaining =
      perTerm > 0 ? Math.ceil((overall.creditsRequired - earnedCredits) / perTerm) : null;
    const paceLine =
      completedTerms > 0
        ? `You've completed ${earnedCredits} of ${overall.creditsRequired} credits (${pct}%) across ${completedTerms} completed term${completedTerms === 1 ? '' : 's'}, averaging ${perTerm.toFixed(1)} credits/term.`
        : `You've completed ${earnedCredits} of ${overall.creditsRequired} credits (${pct}%), but no term is marked completed yet, so I can't project a pace.`;
    const projectionLine =
      termsRemaining !== null
        ? ` At that pace, you'd need roughly ${termsRemaining} more term${termsRemaining === 1 ? '' : 's'} to finish.`
        : '';
    return { reply: paceLine + projectionLine };
  }

  if (NEXT_TERM.test(q)) {
    const categoryProgress = computeCategoryProgress(degreeProfile.categories, degreeCourses)
      .filter((c) => c.creditsRemaining > 0)
      .sort((a, b) => b.creditsRemaining - a.creditsRemaining);

    if (categoryProgress.length === 0) {
      return {
        reply:
          "Every requirement category in your Degree Compass plan is fully covered - looks like you're set. Double check with your advisor before assuming you're done.",
      };
    }
    const lines = categoryProgress
      .slice(0, 3)
      .map((c) => `- ${c.category.name}: ${c.creditsRemaining} credits still needed`)
      .join('\n');
    return {
      reply: `Based on your saved Degree Compass plan, these categories have the most remaining credits:\n\n${lines}\n\nI don't have your program's specific course catalog or prerequisite chains, so I can't name exact courses - check your catalog or advisor for what's offered next term in these categories.`,
    };
  }

  return {
    reply: `I can't answer that one without the AI, which isn't available right now. What I can tell you: you've completed ${earnedCredits} of ${overall.creditsRequired} credits (${pct}%) toward ${degreeProfile.majorName}. In this mode I only understand questions like "what should I take next", "am I on track to graduate" and "should I drop a course".`,
  };
}
