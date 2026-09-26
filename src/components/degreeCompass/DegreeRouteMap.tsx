import { Card } from '@/components/ui/Card';
import { buildDegreeRoute, type RouteStopState } from '@/lib/degreeCompass/progress';
import type { DegreeCourse, DegreeRequirementCategory } from '@/types/degreeCompass';
import { cn } from '@/lib/utils';

/** A full-time term, for turning unplanned credits into "about N terms". */
const CREDITS_PER_TERM = 15;

type StopKind = 'start' | RouteStopState | 'gap' | 'finish';

interface Stop {
  key: string;
  kind: StopKind;
  title: string;
  detail: string;
  running?: string;
}

const STATE_TEXT: Partial<Record<StopKind, string>> = {
  done: 'Completed',
  current: 'In progress',
  planned: 'Planned',
};

function CheckIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function CapIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinejoin="round" d="M12 4L2 9l10 5 10-5-10-5z" />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6 11.5V16c3 2.5 9 2.5 12 0v-4.5M22 9v5"
      />
    </svg>
  );
}

function Dot({ kind }: { kind: StopKind }) {
  const base = 'relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full';
  switch (kind) {
    case 'start':
      return (
        <span className={cn(base, 'border-2 border-border bg-card')}>
          <span className="h-2 w-2 rounded-full bg-muted-foreground" />
        </span>
      );
    case 'done':
      return (
        <span className={cn(base, 'bg-[#00a88c] text-white shadow-[0_4px_14px_-4px_#00a88c]')}>
          <CheckIcon />
        </span>
      );
    case 'current':
      return (
        <span className={cn(base, 'bg-primary text-primary-foreground')}>
          <span className="absolute inset-0 rounded-full bg-primary/40 motion-safe:animate-ping" />
          <span className="relative h-2.5 w-2.5 rounded-full bg-primary-foreground" />
        </span>
      );
    case 'planned':
      return <span className={cn(base, 'border-2 border-muted-foreground/60 bg-card')} />;
    case 'gap':
      return (
        <span
          className={cn(
            base,
            'border-2 border-dashed border-load-medium bg-card text-sm font-bold text-load-medium',
          )}
        >
          ?
        </span>
      );
    case 'finish':
      return (
        <span
          className={cn(
            base,
            'bg-gradient-brand text-white shadow-[0_6px_18px_-6px_rgba(91,61,245,0.8)]',
          )}
        >
          <CapIcon />
        </span>
      );
  }
}

export interface DegreeRouteMapProps {
  categories: DegreeRequirementCategory[];
  courses: DegreeCourse[];
}

/**
 * The degree as a route you can read at a glance: Start, one stop per term,
 * and Graduation, with the trail solid where you've been and dashed where
 * you're headed. A gap stop appears when the plan doesn't reach the
 * required credits yet.
 */
export function DegreeRouteMap({ categories, courses }: DegreeRouteMapProps) {
  const route = buildDegreeRoute(categories, courses);
  const req = route.creditsRequired;
  const termsToPlan = Math.max(1, Math.ceil(route.creditsUnplanned / CREDITS_PER_TERM));

  const stops: Stop[] = [
    { key: 'start', kind: 'start', title: 'Start', detail: '0 cr' },
    ...route.stops.map((s) => ({
      key: s.term,
      kind: s.state,
      title: s.term,
      detail: `${s.credits} cr · ${s.courseCount} ${s.courseCount === 1 ? 'course' : 'courses'}`,
      running: `${s.cumulativeCredits} of ${req} cr`,
    })),
    ...(route.creditsUnplanned > 0
      ? [
          {
            key: 'gap',
            kind: 'gap' as const,
            title: `${route.creditsUnplanned} cr still to plan`,
            detail: `about ${termsToPlan} more ${termsToPlan === 1 ? 'term' : 'terms'}`,
          },
        ]
      : []),
    { key: 'finish', kind: 'finish', title: 'Graduation', detail: `${req} cr` },
  ];

  const trail = (next: StopKind) =>
    next === 'done'
      ? 'border-[#00a88c]'
      : next === 'current'
        ? 'border-primary'
        : 'border-dashed border-muted-foreground/50';

  const headline = route.graduationTerm
    ? `On track to graduate after ${route.graduationTerm}`
    : route.stops.length === 0
      ? 'Add your courses to draw your route'
      : `Plan ${route.creditsUnplanned} more credits to reach ${req}`;

  return (
    <Card className="rounded-2xl p-5 sm:p-6">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
        Your route
      </p>
      <h2 className="mt-1 font-display text-2xl font-medium tracking-tight text-foreground">
        {headline}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {route.creditsEarned} of {req} credits earned or in progress
        {route.graduationTerm ? ', if your plan holds.' : '.'}
      </p>

      {/* Long routes scroll sideways; the region is focusable so keyboard
          users can scroll it too. */}
      <div
        tabIndex={0}
        role="region"
        aria-label="Route map"
        className="mt-6 overflow-x-auto rounded-xl pb-1 outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
      >
        <ol
          aria-label="Your route to graduation"
          className="flex flex-col sm:min-w-max sm:flex-row"
        >
          {stops.map((stop, i) => {
            const next = stops[i + 1];
            return (
              <li
                key={stop.key}
                className="relative flex gap-3 pb-6 last:pb-0 sm:min-w-[6rem] sm:flex-1 sm:flex-col sm:items-center sm:pb-0 sm:text-center"
              >
                {next && (
                  <span
                    aria-hidden="true"
                    className={cn(
                      'absolute left-[15px] top-8 bottom-0 border-l-2',
                      'sm:bottom-auto sm:left-1/2 sm:top-[15px] sm:w-full sm:border-l-0 sm:border-t-2',
                      trail(next.kind),
                    )}
                  />
                )}
                <Dot kind={stop.kind} />
                <div className="min-w-0 pt-1 sm:px-1.5 sm:pt-2">
                  {stop.kind === 'current' && (
                    <span className="mb-1 inline-block rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
                      You are here
                    </span>
                  )}
                  <p
                    className={cn(
                      'text-sm font-semibold text-foreground',
                      stop.kind === 'gap' && 'text-load-medium',
                    )}
                  >
                    {stop.title}
                    {STATE_TEXT[stop.kind] && (
                      <span className="sr-only">, {STATE_TEXT[stop.kind]}</span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">{stop.detail}</p>
                  {stop.running && (
                    <p className="text-[11px] tabular-nums text-muted-foreground">{stop.running}</p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </Card>
  );
}
