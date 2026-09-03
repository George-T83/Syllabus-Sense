'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';

/**
 * Pill-shaped action button for card headers (e.g. "+ Add Course", "View all
 * tasks"). Replaces the old bare `text-primary hover:underline` links, which
 * read as default browser hyperlinks rather than part of the design system.
 * `variant="solid"` is for the primary action in a header (usually a "+ Add"
 * button); `variant="ghost"` is for secondary navigation ("View all →").
 */
const baseClass =
  'inline-flex shrink-0 items-center justify-center gap-1 rounded-full text-xs font-semibold transition-colors active:scale-[0.97] min-h-[44px]';

const variantClass = {
  solid: 'bg-primary/10 text-primary px-3.5 py-2 hover:bg-primary/20',
  ghost:
    'border border-border text-muted-foreground px-3.5 py-2 hover:border-primary/30 hover:bg-primary/5 hover:text-primary',
} as const;

export type CardActionVariant = keyof typeof variantClass;

function PlusIcon() {
  return (
    <svg
      className="h-3.5 w-3.5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2.5}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg
      className="h-3.5 w-3.5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2.5}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}

interface SharedProps {
  children: React.ReactNode;
  variant?: CardActionVariant;
  /** Shows a leading "+" glyph, for creation actions. */
  withPlus?: boolean;
  /** Shows a trailing chevron, for "view more"/navigation actions. */
  withChevron?: boolean;
  className?: string;
}

export function CardActionLink({
  href,
  children,
  variant = 'ghost',
  withPlus,
  withChevron,
  className,
  ...rest
}: SharedProps & { href: string } & React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <Link href={href} className={cn(baseClass, variantClass[variant], className)} {...rest}>
      {withPlus && <PlusIcon />}
      {children}
      {withChevron && <ChevronRightIcon />}
    </Link>
  );
}

export function CardActionButton({
  children,
  variant = 'ghost',
  withPlus,
  withChevron,
  className,
  type = 'button',
  ...rest
}: SharedProps & { type?: 'button' | 'submit' } & Omit<
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    'type' | 'className' | 'children'
  >) {
  return (
    <button
      type={type}
      className={cn(baseClass, variantClass[variant], 'disabled:opacity-50', className)}
      {...rest}
    >
      {withPlus && <PlusIcon />}
      {children}
      {withChevron && <ChevronRightIcon />}
    </button>
  );
}
