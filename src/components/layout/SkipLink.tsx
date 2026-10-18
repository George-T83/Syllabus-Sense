/** Id of the page's main landmark; every layout's <main> must carry it. */
export const MAIN_CONTENT_ID = 'main-content';

/**
 * "Skip to main content": the first tab stop on every page. Hidden until it
 * receives keyboard focus, then pinned top-left above the fixed navbar so
 * keyboard users can jump past the chrome (navbar, sidebar) to the page.
 */
export default function SkipLink() {
  return (
    <a
      href={`#${MAIN_CONTENT_ID}`}
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-foreground focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-foreground focus:ring-offset-2 focus:ring-offset-background"
    >
      Skip to main content
    </a>
  );
}
