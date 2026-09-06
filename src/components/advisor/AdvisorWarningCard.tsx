import { CardActionLink } from '@/components/ui/CardAction';
import type { AdvisorWarning } from '@/types/advisor';

/**
 * The one UI pattern that applies to every Advisor reply, not just the
 * high-stakes ones: a visibly distinct callout (load-high, the same amber
 * this app already uses for "important but not destructive" - see the
 * Dashboard's "Tight · start today" badge) so a drop/withdraw/graduation
 * question never reads as just another paragraph of chat text.
 */
export function AdvisorWarningCard({ warning }: { warning: AdvisorWarning }) {
  return (
    <div className="rounded-2xl border border-load-high/30 bg-load-high/10 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <svg
          className="h-5 w-5 shrink-0 text-load-high"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        <span className="text-label font-semibold text-load-high">{warning.reason}</span>
      </div>
      <p className="text-body-sm text-foreground">{warning.detail}</p>
      <p className="text-caption italic text-muted-foreground">
        This is a projection from your saved data, not your official transcript - I can be wrong
        about prerequisite chains or enrollment rules. I&rsquo;m not a substitute for your academic
        advisor on a decision like this.
      </p>
      <CardActionLink href="/contacts" variant="ghost">
        Message your advisor
      </CardActionLink>
    </div>
  );
}
