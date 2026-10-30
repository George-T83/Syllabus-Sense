import * as React from 'react';
import { cn } from '@/lib/utils';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
  hoverable?: boolean;
  /**
   * Every card is a plain flat bordered card by default - a modal dialog is
   * already the sole focus of attention behind its own backdrop, and an
   * in-page card sitting in normal page flow doesn't need a decorative
   * border to earn a look, so the default costs nothing extra to opt out
   * of. `"glow"` opts in to the brand-gradient "Neon Edge" border + ambient
   * glow (globals.css `.glow-edge-low`) for a card that should genuinely
   * stand out; `true` (or `"top"`) instead draws a gradient bar along the
   * top edge; `"left"` draws a solid primary-colored border down the left
   * edge. A card whose glow should escalate with real severity
   * (medium/high/critical, breathing) passes `accent="glow"` and layers
   * WORKLOAD_GLOW_CLASS (lib/workload/uiClasses.ts) on top via `className`.
   */
  accent?: boolean | 'top' | 'left' | 'glow' | 'none';
  /**
   * The default `surface-luminous` is a deliberately frosted pane that lets
   * the page's nebula glow through an in-page card, but that translucency
   * would let a modal dialog's backdrop bleed the page through the panel
   * itself. Modal panels (this Card wrapping a `role="dialog"` element)
   * pass `opaque` for `surface-solid`; in-page cards keep the frosted default.
   */
  opaque?: boolean;
}

const PADDING_TOKEN = /^(p|px|py|pt|pr|pb|pl)-/;
const paddingGroup = (token: string) => (PADDING_TOKEN.exec(token) ?? [])[1];

/**
 * Joins a section's default padding with the caller's classes. `cn` only
 * concatenates, and when two padding classes of the same kind are both
 * present the one defined later in the stylesheet wins, not the caller's. So
 * `<CardHeader className="p-0">` kept its default `p-6` and the card ended up
 * with its own padding plus 24px more on every side: on a 390px phone the
 * content of the Workload and forecast cards was squeezed into about 250px.
 * A default padding class is dropped when the caller supplies one of the same
 * kind (p with p, pt with pt, and so on), which is what the caller meant.
 */
export function withPaddingDefaults(defaults: string, className?: string): string {
  if (!className) return defaults;
  const groups = new Set(className.split(/\s+/).map(paddingGroup).filter(Boolean));
  const kept = defaults.split(/\s+/).filter((token) => {
    const group = paddingGroup(token);
    return !group || !groups.has(group);
  });
  return cn(kept.join(' '), className);
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, children, interactive, hoverable, accent, opaque, ...props }, ref) => {
    const isInteractive = interactive || hoverable;
    const accentTop = accent === true || accent === 'top';
    const accentLeft = accent === 'left';
    const accentGlow = accent === 'glow';
    return (
      <div
        ref={ref}
        className={cn(
          'relative rounded-glass overflow-hidden',
          accentGlow
            ? 'glow-edge glow-edge-low'
            : opaque
              ? 'border border-border surface-solid shadow-card'
              : 'border border-border surface-luminous shadow-card',
          isInteractive &&
            'transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-card-hover',
          accentLeft && 'border-l-[3px] border-l-primary',
          className,
        )}
        {...props}
      >
        {accentTop && <div className="absolute inset-x-0 top-0 h-1 bg-gradient-brand" />}
        {children}
      </div>
    );
  },
);
Card.displayName = 'Card';

export type CardHeaderProps = React.HTMLAttributes<HTMLDivElement>;
export const CardHeader = React.forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={withPaddingDefaults('flex flex-col space-y-1.5 p-6', className)}
      {...props}
    />
  ),
);
CardHeader.displayName = 'CardHeader';

export interface CardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  /** Heading level to render. Defaults to h3; a page's own title card passes h1. */
  as?: 'h1' | 'h2' | 'h3';
}
export const CardTitle = React.forwardRef<HTMLHeadingElement, CardTitleProps>(
  ({ className, as: Tag = 'h3', ...props }, ref) => (
    <Tag
      ref={ref}
      className={cn('text-h3 font-extrabold tracking-tight text-foreground', className)}
      {...props}
    />
  ),
);
CardTitle.displayName = 'CardTitle';

export type CardDescriptionProps = React.HTMLAttributes<HTMLParagraphElement>;
export const CardDescription = React.forwardRef<HTMLParagraphElement, CardDescriptionProps>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn('text-body-sm text-muted-foreground', className)} {...props} />
  ),
);
CardDescription.displayName = 'CardDescription';

export type CardContentProps = React.HTMLAttributes<HTMLDivElement>;
export const CardContent = React.forwardRef<HTMLDivElement, CardContentProps>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={withPaddingDefaults('p-6 pt-0', className)} {...props} />
  ),
);
CardContent.displayName = 'CardContent';

export type CardFooterProps = React.HTMLAttributes<HTMLDivElement>;
export const CardFooter = React.forwardRef<HTMLDivElement, CardFooterProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={withPaddingDefaults(
        'flex items-center p-6 pt-4 mt-2 border-t border-white/10 dark:border-white/5',
        className,
      )}
      {...props}
    />
  ),
);
CardFooter.displayName = 'CardFooter';
