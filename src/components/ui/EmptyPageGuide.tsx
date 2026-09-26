import type { ReactNode } from 'react';
import { Card } from '@/components/ui/Card';

export interface EmptyPageGuidePreview {
  /** Usually a `SectionIcon` - it brings its own badge. */
  icon: ReactNode;
  title: string;
  detail: string;
}

export interface EmptyPageGuideProps {
  /** Serif headline - what the page is for, in the student's words. */
  title: string;
  lead: string;
  /** What the page will show once there's data: a short, concrete list. */
  previews: EmptyPageGuidePreview[];
  /** The buttons that get them there - primary first. */
  actions: ReactNode;
}

/**
 * The whole-page empty state for a screen that has nothing to show yet:
 * instead of rendering every card at zero ("0.0h", "0 items", "LIGHT"), it
 * says what the page will do and how to fill it. A single card's empty
 * state stays `EmptyState`; this is for when the page as a whole is empty.
 */
export function EmptyPageGuide({ title, lead, previews, actions }: EmptyPageGuideProps) {
  return (
    <Card className="rounded-2xl p-5 sm:p-8">
      <h2 className="font-display text-2xl font-medium tracking-tight text-foreground sm:text-3xl">
        {title}
      </h2>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{lead}</p>

      <div className="mt-5 flex flex-wrap items-center gap-2">{actions}</div>

      <p className="mt-8 text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
        What you&apos;ll see here
      </p>
      <ul className="mt-3 grid gap-3 sm:grid-cols-3">
        {previews.map((p) => (
          <li key={p.title} className="rounded-xl border border-border/70 bg-background/40 p-4">
            <span aria-hidden="true" className="block">
              {p.icon}
            </span>
            <p className="mt-3 text-sm font-semibold text-foreground">{p.title}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{p.detail}</p>
          </li>
        ))}
      </ul>
    </Card>
  );
}
