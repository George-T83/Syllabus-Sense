'use client';

import { usePillHidden, useTextSize } from '@/hooks/useDisplayPrefs';
import { PILL_LABELS, TEXT_SIZE_OPTIONS, type PillId } from '@/lib/display/displayPrefs';
import { cn } from '@/lib/utils';

const PILLS: PillId[] = ['advisor', 'focus'];

function PillSwitch({ id }: { id: PillId }) {
  const [hidden, setHidden] = usePillHidden(id);
  const label = `Show the ${PILL_LABELS[id]} button`;
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <span className="text-sm font-medium text-foreground">{PILL_LABELS[id]}</span>
      <button
        type="button"
        role="switch"
        aria-label={label}
        aria-checked={!hidden}
        onClick={() => setHidden(!hidden)}
        className={cn(
          'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-card',
          hidden ? 'bg-muted' : 'bg-primary',
        )}
      >
        <span
          className={cn(
            'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
            hidden ? 'translate-x-1' : 'translate-x-6',
          )}
        />
      </button>
    </div>
  );
}

/**
 * Readability controls that live on this device, not the account: text size
 * and the two floating buttons that sit over the page.
 */
export function DisplaySettings() {
  const [textSize, setTextSize] = useTextSize();

  return (
    <div data-testid="display-settings">
      <div className="border-t border-border pt-4" data-testid="text-size-setting">
        <h3 className="text-sm font-semibold text-foreground">Text size</h3>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Makes all text, and the space around it, larger. Saved on this device.
        </p>
        <div role="group" aria-label="Text size" className="mt-3 flex flex-wrap gap-2">
          {TEXT_SIZE_OPTIONS.map((option) => {
            const selected = textSize === option.value;
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={selected}
                onClick={() => setTextSize(option.value)}
                className={cn(
                  'min-h-[44px] rounded-full border-2 px-4 text-sm font-semibold transition-colors',
                  selected
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground hover:bg-accent/60 hover:text-foreground',
                )}
              >
                {option.label}
                <span className="ml-1.5 font-normal opacity-70">{option.percent}%</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-5 border-t border-border pt-4" data-testid="floating-buttons-setting">
        <h3 className="text-sm font-semibold text-foreground">Floating buttons</h3>
        <p className="mt-0.5 text-sm text-muted-foreground">
          The shortcuts that float over every page. Hidden ones still open from the keyboard and the
          search bar. Saved on this device.
        </p>
        <div className="mt-1 divide-y divide-border">
          {PILLS.map((id) => (
            <PillSwitch key={id} id={id} />
          ))}
        </div>
      </div>
    </div>
  );
}
