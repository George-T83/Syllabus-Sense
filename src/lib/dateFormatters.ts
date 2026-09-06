/**
 * Shared Intl.DateTimeFormat instances. A formatter is stateless once
 * constructed, so building each recipe once here and importing it wherever
 * it's needed avoids every consuming file re-declaring its own - several
 * already had, byte-for-byte, the same recipe under a different local name.
 */

/** "Sep 6" */
export const SHORT_DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
});

/** "Sat" */
export const WEEKDAY_SHORT_FORMATTER = new Intl.DateTimeFormat('en-US', { weekday: 'short' });

/** "Sep" */
export const MONTH_SHORT_FORMATTER = new Intl.DateTimeFormat('en-US', { month: 'short' });

/** "September 2026" */
export const MONTH_YEAR_FORMATTER = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  year: 'numeric',
});

/** "Sat, Sep 6" */
export const WEEKDAY_SHORT_DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
});

/** "Saturday, September 6" */
export const WEEKDAY_LONG_DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
});

/** "Saturday, September 6, 2026" */
export const WEEKDAY_LONG_DATE_YEAR_FORMATTER = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  year: 'numeric',
});

/** "September 6, 2026" */
export const LONG_DATE_YEAR_FORMATTER = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
});

/** "2:30 PM" */
export const TIME_FORMATTER = new Intl.DateTimeFormat('en-US', {
  hour: '2-digit',
  minute: '2-digit',
});
