import { Card } from '@/components/ui/Card';

export interface StatTileProps {
  label: string;
  value: string;
  sub?: string;
}

/** A small label/value/sub-line card for a stats row (e.g. the Mood Recap's
 * Check-ins / Average mood / Streak / Best day grid). */
export function StatTile({ label, value, sub }: StatTileProps) {
  return (
    <Card className="rounded-2xl p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold text-foreground">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </Card>
  );
}
