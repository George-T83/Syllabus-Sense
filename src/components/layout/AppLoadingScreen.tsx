import Logo from './Logo';

/**
 * Shown while auth state resolves on a hard navigation (full page load or
 * refresh) - before this existed it was a bare unstyled "Loading..." with
 * no app chrome at all, which reads as broken on an otherwise-polished app
 * and happens on every refresh/deep-link, not just first login.
 */
export default function AppLoadingScreen() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
      <Logo className="h-12 w-12 animate-pulse" />
      <div className="relative h-1 w-24 overflow-hidden rounded-full bg-muted">
        <div className="absolute h-full animate-[loading-bar_1.4s_ease-in-out_infinite] rounded-full bg-gradient-brand" />
      </div>
    </div>
  );
}
