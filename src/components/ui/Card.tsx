import * as React from 'react';
import { cn } from '@/lib/utils';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
  hoverable?: boolean;
  /**
   * Renders a brand accent marking this card as visually important.
   * `true` (or `"top"`) draws a gradient bar along the top edge; `"left"`
   * draws a solid primary-colored border down the left edge instead - used
   * to promote a single card as the dominant/primary one in a section.
   */
  accent?: boolean | 'top' | 'left';
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, children, interactive, hoverable, accent, ...props }, ref) => {
    const isInteractive = interactive || hoverable;
    const accentTop = accent === true || accent === 'top';
    const accentLeft = accent === 'left';
    return (
      <div
        ref={ref}
        className={cn(
          'relative rounded-glass border border-border bg-card/90 backdrop-blur-md shadow-card overflow-hidden',
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
    <div ref={ref} className={cn('flex flex-col space-y-1.5 p-6', className)} {...props} />
  ),
);
CardHeader.displayName = 'CardHeader';

export type CardTitleProps = React.HTMLAttributes<HTMLHeadingElement>;
export const CardTitle = React.forwardRef<HTMLHeadingElement, CardTitleProps>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn('text-lg font-semibold leading-none tracking-tight text-foreground', className)}
      {...props}
    />
  ),
);
CardTitle.displayName = 'CardTitle';

export type CardDescriptionProps = React.HTMLAttributes<HTMLParagraphElement>;
export const CardDescription = React.forwardRef<HTMLParagraphElement, CardDescriptionProps>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn('text-sm text-muted-foreground', className)} {...props} />
  ),
);
CardDescription.displayName = 'CardDescription';

export type CardContentProps = React.HTMLAttributes<HTMLDivElement>;
export const CardContent = React.forwardRef<HTMLDivElement, CardContentProps>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('p-6 pt-0', className)} {...props} />
  ),
);
CardContent.displayName = 'CardContent';

export type CardFooterProps = React.HTMLAttributes<HTMLDivElement>;
export const CardFooter = React.forwardRef<HTMLDivElement, CardFooterProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'flex items-center p-6 pt-4 mt-2 border-t border-white/10 dark:border-white/5',
        className,
      )}
      {...props}
    />
  ),
);
CardFooter.displayName = 'CardFooter';
