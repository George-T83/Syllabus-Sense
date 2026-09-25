'use client';

import { Card } from '@/components/ui/Card';
import { CardActionLink } from '@/components/ui/CardAction';
import { SectionIcon } from '@/components/ui/SectionIcon';
import { useAppState } from '@/context/AppStateContext';
import { detectBurnoutRisk, suggestBurnoutTriage } from '@/lib/burnout/detectBurnoutRisk';
import { SHORT_DATE_FORMATTER } from '@/lib/dateFormatters';

/**
 * Part B #12: a proactive nudge when the workload-vs-mood data this cycle
 * introduced (see lib/mood/moodStats.ts) shows a real pattern, not just one
 * rough day - two or more consecutive heavy weeks together with a
 * genuinely declining mood trend (see detectBurnoutRisk for the exact
 * thresholds and why). Renders nothing otherwise; this is meant to be rare.
 */
export function BurnoutWarningCard() {
  const { state } = useAppState();
  const risk = detectBurnoutRisk(state.scheduleItems, state.moodEntries);
  if (!risk.atRisk) return null;

  const triage = suggestBurnoutTriage(state.scheduleItems);
  const extension = triage.find((t) => t.type === 'extension');
  const deprioritize = triage.find((t) => t.type === 'deprioritize');

  return (
    <Card accent="none" className="rounded-2xl border-load-high/30 bg-load-high/10 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <SectionIcon icon="alertTriangle" className="bg-load-high/15 text-load-high" />
          <div className="min-w-0 space-y-1.5">
            <span className="text-caption font-semibold uppercase tracking-wide text-load-high">
              Burnout check-in
            </span>
            <p className="text-body-sm font-semibold text-foreground">
              {risk.consecutiveHeavyWeeks} heavy weeks in a row, and your mood&rsquo;s been trending
              down. Worth looking at what&rsquo;s actually due.
            </p>
            {(extension || deprioritize) && (
              <ul className="space-y-1 text-body-sm text-muted-foreground">
                {extension && (
                  <li>
                    Consider asking for an extension on{' '}
                    <span className="font-medium text-foreground">{extension.item.title}</span> (due{' '}
                    {SHORT_DATE_FORMATTER.format(new Date(extension.item.dueDate))},{' '}
                    {extension.item.estimatedHours}h)
                  </li>
                )}
                {deprioritize && (
                  <li>
                    <span className="font-medium text-foreground">{deprioritize.item.title}</span>{' '}
                    is low-priority and due{' '}
                    {SHORT_DATE_FORMATTER.format(new Date(deprioritize.item.dueDate))} - safe to
                    push if you need the room.
                  </li>
                )}
              </ul>
            )}
          </div>
        </div>
        <CardActionLink href="/tasks" variant="solid" withChevron className="shrink-0">
          Review your plan
        </CardActionLink>
      </div>
    </Card>
  );
}
