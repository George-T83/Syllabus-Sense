export default function Home() {
  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center p-8 bg-background text-foreground overflow-hidden">
      {/* Decorative gradient background blobs to showcase backdrop-blur of the .glass helper */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl -z-10 animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/20 rounded-full blur-3xl -z-10" />

      <main className="max-w-4xl w-full flex flex-col gap-glass-gap z-10">
        <header className="text-center space-y-2">
          <h1 className="text-glass-title font-bold tracking-tight">
            Syllabus Sense
          </h1>
          <p className="text-glass-subtitle text-muted-foreground">
            Design Tokens & Theme Showcase (Issue #2)
          </p>
        </header>

        {/* Translucent Glass Card */}
        <section className="glass rounded-glass p-glass-padding space-y-6">
          <div className="border-b border-border/40 pb-4">
            <h2 className="text-xl font-semibold">Glassmorphic Container (.glass)</h2>
            <p className="text-sm text-muted-foreground">
              Translucent frosted-glass backdrop with backdrop-blur, semi-transparent background, and soft border.
            </p>
          </div>

          {/* Grid of design token swatches */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {/* Primary Card */}
            <div className="bg-primary text-primary-foreground p-4 rounded-md shadow-sm">
              <h3 className="font-bold">Primary</h3>
              <p className="text-xs opacity-90">bg-primary text-primary-foreground</p>
            </div>

            {/* Secondary Card */}
            <div className="bg-secondary text-secondary-foreground p-4 rounded-md border border-border">
              <h3 className="font-bold">Secondary</h3>
              <p className="text-xs text-muted-foreground">bg-secondary text-secondary-foreground</p>
            </div>

            {/* Accent Card */}
            <div className="bg-accent text-accent-foreground p-4 rounded-md">
              <h3 className="font-bold">Accent</h3>
              <p className="text-xs opacity-90">bg-accent text-accent-foreground</p>
            </div>

            {/* Muted Card */}
            <div className="bg-muted text-muted-foreground p-4 rounded-md">
              <h3 className="font-bold">Muted</h3>
              <p className="text-xs">bg-muted text-muted-foreground</p>
            </div>

            {/* Card Card */}
            <div className="bg-card text-card-foreground p-4 rounded-md border border-border">
              <h3 className="font-bold">Card</h3>
              <p className="text-xs text-muted-foreground">bg-card text-card-foreground</p>
            </div>

            {/* Destructive Card */}
            <div className="bg-destructive text-destructive-foreground p-4 rounded-md">
              <h3 className="font-bold">Destructive</h3>
              <p className="text-xs opacity-90">bg-destructive text-destructive-foreground</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-4 text-xs justify-between pt-2 text-muted-foreground border-t border-border/20">
            <div>
              Border Color: <span className="border border-border px-2 py-0.5 rounded bg-card">Sample Border</span>
            </div>
            <div>
              Custom Spacing: <code className="bg-muted px-1.5 py-0.5 rounded">p-glass-padding</code> &amp; <code className="bg-muted px-1.5 py-0.5 rounded">gap-glass-gap</code>
            </div>
            <div>
              Border Radius: <code className="bg-muted px-1.5 py-0.5 rounded">rounded-glass</code>
            </div>
          </div>
        </section>

        {/* Note on how to test Dark Mode */}
        <footer className="text-center text-xs text-muted-foreground">
          Tip: Add the <code className="bg-muted px-1 py-0.5 rounded">dark</code> class to the <code className="bg-muted px-1 py-0.5 rounded">&lt;html&gt;</code> element to test the dark mode theme.
        </footer>
      </main>
    </div>
  );
}

