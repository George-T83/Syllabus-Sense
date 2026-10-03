'use client';

import { Card } from '@/components/ui/Card';
import { useModalA11y } from '@/hooks/useModalA11y';
import { usePlatform } from '@/hooks/usePlatformKey';
import { SHORTCUT_HINTS } from '@/lib/shortcuts';

const REVIEW_SHORTCUTS: { keys: string; label: string }[] = [
  { keys: 'Space', label: 'Flip the card' },
  { keys: '1 – 4', label: 'Rate the card' },
  { keys: '← →', label: 'Again / Good' },
];

export function ShortcutsCheatSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const platform = usePlatform();
  const dialogRef = useModalA11y<HTMLDivElement>(open, onClose);
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex overflow-y-auto bg-black/40 px-4 py-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-title"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="relative m-auto w-full max-w-md outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <Card accent="none" opaque className="p-6">
          <div className="flex items-start justify-between gap-3">
            <h2 id="shortcuts-title" className="text-lg font-semibold text-foreground">
              Keyboard shortcuts
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close keyboard shortcuts"
              data-autofocus
              className="inline-flex min-h-[36px] items-center rounded-full px-3 text-xs font-semibold text-muted-foreground transition-colors hover:bg-accent"
            >
              Close
            </button>
          </div>

          <ShortcutList
            heading="Anywhere"
            rows={SHORTCUT_HINTS.map((s) => ({ keys: s.keys(platform), label: s.label }))}
          />
          <ShortcutList heading="Flashcard review" rows={REVIEW_SHORTCUTS} />
          <p className="mt-4 text-xs text-muted-foreground">
            Press Esc to close the palette or any dialog. Ctrl+P is left alone so you can print.
          </p>
        </Card>
      </div>
    </div>
  );
}

function ShortcutList({
  heading,
  rows,
}: {
  heading: string;
  rows: { keys: string; label: string }[];
}) {
  return (
    <section className="mt-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {heading}
      </h3>
      <dl className="mt-2 divide-y divide-border/60">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-4 py-2">
            <dt className="text-sm text-foreground">{row.label}</dt>
            <dd>
              <kbd className="rounded-md border border-border/70 bg-muted/60 px-2 py-0.5 font-mono text-xs text-foreground">
                {row.keys}
              </kbd>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
