/**
 * Same three stops as globals.css's --brand-gradient-* custom properties
 * (which back .bg-gradient-brand/.text-gradient-brand/.spinner-gradient),
 * shaped for inline SVG `<stop>` elements - CSS custom properties resolve
 * fine as SVG presentation-attribute values (the same trick WORKLOAD_RAW_COLOR
 * already relies on for chart fills), so an SVG gradient reads the identical
 * source instead of re-declaring the hex literals a second time.
 */
export const BRAND_GRADIENT_STOPS = [
  { offset: '0%', color: 'var(--brand-gradient-start)' },
  { offset: '55%', color: 'var(--brand-gradient-mid)' },
  { offset: '100%', color: 'var(--brand-gradient-end)' },
] as const;
