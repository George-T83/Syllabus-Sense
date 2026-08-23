import Link from 'next/link';
import Logo from '@/components/layout/Logo';
import { ICON_PATHS, type IconKey } from '@/lib/icons';

/**
 * The three real differentiators this page pitches, grounded in what the
 * product actually does (not generic "beautiful calendar" filler):
 * automatic syllabus parsing (src/lib/ai/syllabusExtractionTool.ts extracts
 * assignments, grade weights, and flags high-stakes items), the
 * workload-aware planner with overload detection (src/lib/planner/
 * computeSmartPlan.ts), and the unified calendar that follows from both.
 */
const FEATURES: { icon: IconKey; title: string; description: string }[] = [
  {
    icon: 'syllabus',
    title: 'Upload the syllabus, skip the re-typing',
    description:
      'Every assignment, exam, and grade weight is pulled straight off the PDF - including the "worth 25% of your grade" line most students only notice in week 12.',
  },
  {
    icon: 'planner',
    title: 'A planner that flags overload before it happens',
    description:
      'Each item gets a recommended start date based on your real weekly workload, and weeks that are already full are flagged instead of quietly overbooked.',
  },
  {
    icon: 'calendar',
    title: 'Every deadline, one calendar',
    description:
      'Class meetings, due dates, and high-stakes items from every course sit on the same month, week, and agenda views - nothing left buried in a separate PDF.',
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-2">
            <Logo className="h-8 w-8 shrink-0" />
            <span className="text-base font-bold tracking-tight text-foreground">
              Syllabus Sense
            </span>
          </div>
          <nav className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/login"
              className="rounded-lg px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              Sign up
            </Link>
          </nav>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="mx-auto max-w-6xl px-4 pb-14 pt-12 sm:px-6 sm:pb-20 sm:pt-16">
          <div className="grid gap-10 lg:grid-cols-2 lg:items-center lg:gap-12">
            <div>
              <h1 className="text-3xl font-bold leading-tight tracking-tight text-foreground sm:text-4xl lg:text-[2.75rem] lg:leading-[1.1]">
                Never miss the grade-critical deadline{' '}
                <span className="text-gradient-brand">buried on page 6</span> of a syllabus.
              </h1>
              <p className="mt-5 text-base leading-relaxed text-muted-foreground sm:text-lg">
                Upload a syllabus and Syllabus Sense pulls out every assignment, exam, and grade
                weight automatically - then plans your week around them so a 25%-of-your-grade
                project never sneaks up on you next to three other things due the same day.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/signup"
                  className="inline-flex items-center justify-center rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-card transition-opacity hover:opacity-90"
                >
                  Get started free
                </Link>
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center rounded-lg border border-border bg-card px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-accent"
                >
                  Log in
                </Link>
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
                No credit card. Upload your first syllabus in under a minute.
              </p>
            </div>

            <div className="lg:pl-4">
              <SyllabusMockup />
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="border-t border-border bg-card/40">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
            <h2 className="text-center text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              What actually changes once it&apos;s uploaded
            </h2>
            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((feature) => (
                <div
                  key={feature.title}
                  className="rounded-glass border border-border bg-card/90 p-6 shadow-card"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-brand text-white">
                    <svg
                      className="h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d={ICON_PATHS[feature.icon]}
                      />
                    </svg>
                  </span>
                  <h3 className="mt-4 text-base font-semibold text-foreground">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
          <div className="rounded-glass-lg bg-gradient-brand px-6 py-10 text-center text-white shadow-card sm:px-12 sm:py-14">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Stop finding out about the 25% project the week it&apos;s due.
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-white/80 sm:text-base">
              Upload your syllabi, get a workload-aware plan, and see the whole semester on one
              calendar.
            </p>
            <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/signup"
                className="inline-flex items-center justify-center rounded-lg bg-white px-6 py-3 text-sm font-semibold text-slate-900 shadow-card transition-opacity hover:opacity-90"
              >
                Sign up free
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-lg border border-white/40 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10"
              >
                I already have an account
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-4 py-8 text-xs text-muted-foreground sm:flex-row sm:justify-between sm:px-6">
          <div className="flex items-center gap-2">
            <Logo className="h-5 w-5 shrink-0" />
            <span className="font-semibold text-foreground">Syllabus Sense</span>
          </div>
          <span>Built for students who&apos;d rather plan the semester once, not weekly.</span>
        </div>
      </footer>
    </div>
  );
}

/**
 * A static, styled "here's what it looks like" panel - not a live demo
 * (out of scope), just a representative mockup of the upload -> parsed
 * syllabus -> workload-aware plan flow, built from the app's real design
 * tokens (brand gradient, card/border/muted colors) rather than generic
 * stock-photo styling.
 */
function SyllabusMockup() {
  return (
    <div className="rounded-glass-lg border border-border bg-card shadow-card">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-destructive/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-load-medium/80" />
        <span className="h-2.5 w-2.5 rounded-full bg-load-low/80" />
        <span className="ml-2 text-xs font-medium text-muted-foreground">
          CSCI213_Syllabus.pdf - parsed
        </span>
      </div>

      <div className="space-y-4 p-4 sm:p-5">
        <div className="rounded-lg border border-border bg-background p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-foreground">Final Project</span>
            <span className="shrink-0 rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-semibold text-destructive">
              High stakes - 25%
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Due Dec 12 - detected automatically</p>
        </div>

        <div className="rounded-lg border border-border bg-background p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-foreground">Problem Set 6</span>
            <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
              10%
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Due Dec 5</p>
        </div>

        <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-foreground">This week&apos;s workload</span>
            <span className="flex items-center gap-1 rounded-full bg-load-high/15 px-2 py-0.5 text-[11px] font-semibold text-load-high">
              <svg
                className="h-3 w-3"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d={ICON_PATHS.alertTriangle} />
              </svg>
              Overloaded Thu
            </span>
          </div>
          <div className="mt-3 flex items-end gap-1.5">
            {[
              { d: 'M', h: 30 },
              { d: 'T', h: 45 },
              { d: 'W', h: 55 },
              { d: 'T', h: 95 },
              { d: 'F', h: 40 },
              { d: 'S', h: 15 },
              { d: 'S', h: 20 },
            ].map((bar, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-1">
                <div className="flex h-16 w-full items-end overflow-hidden rounded-sm bg-muted">
                  <div
                    className={
                      'w-full rounded-sm ' +
                      (bar.h > 80
                        ? 'bg-load-critical'
                        : bar.h > 60
                          ? 'bg-load-high'
                          : 'bg-gradient-brand')
                    }
                    style={{ height: `${bar.h}%` }}
                  />
                </div>
                <span className="text-[10px] text-muted-foreground">{bar.d}</span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Recommended start date moved earlier to make room.
          </p>
        </div>
      </div>
    </div>
  );
}
