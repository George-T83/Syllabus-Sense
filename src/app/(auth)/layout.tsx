import Logo from '@/components/layout/Logo';
import { ICON_PATHS, type IconKey } from '@/lib/icons';

const PILLARS: { icon: IconKey; title: string; description: string }[] = [
  {
    icon: 'syllabus',
    title: 'Syllabus, uploaded once',
    description: 'Keep every syllabus file attached to its course, always within reach.',
  },
  {
    icon: 'planner',
    title: 'A planner that gets it',
    description: 'A workload-aware plan that tells you what to start today, this week, and later.',
  },
  {
    icon: 'calendar',
    title: 'One beautiful calendar',
    description:
      'Month, week, and agenda views with your real class schedule and deadlines together.',
  },
];

export default function AuthGroupLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      {/* Brand panel: the primary logo/identity moment on this page, so the
          form-side card keeps its own logo small and mobile-only (see
          login/signup pages) rather than duplicating it next to this.
          Everything - logo, headline, pillars - lives in one vertically-
          centered block instead of being split top/bottom via
          justify-between, which pinned the headline near the top and left a
          dead gap before the pillars. */}
      <div className="hidden shrink-0 flex-col justify-center bg-gradient-brand p-10 text-white md:flex md:w-[42%] lg:w-1/2">
        <div className="max-w-sm">
          {/* Deliberately hardcoded dark text, not text-foreground: this
              chip's background is always white regardless of theme, so a
              theme-aware token would flip to white-on-white in dark mode. */}
          <div className="inline-flex items-center gap-3 rounded-2xl bg-white/95 px-4 py-3 shadow-lg">
            <Logo className="h-9 w-9 shrink-0" />
            <span className="text-lg font-bold tracking-tight text-slate-900">Syllabus Sense</span>
          </div>
          <p className="mt-8 text-3xl font-bold leading-tight">
            Your whole semester, actually organized.
          </p>
          <p className="mt-3 text-sm text-white/75">
            Upload once, plan smarter, and see it all on one beautiful calendar.
          </p>

          <ul className="mt-10 space-y-5">
            {PILLARS.map((pillar) => (
              <li key={pillar.title} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/15">
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d={ICON_PATHS[pillar.icon]}
                    />
                  </svg>
                </span>
                <div>
                  <div className="text-sm font-semibold">{pillar.title}</div>
                  <div className="text-xs text-white/70">{pillar.description}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center bg-background px-4 py-12">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}
