'use client';

import { useState, type FormEvent } from 'react';
import { Card } from '@/components/ui/Card';
import { buildDefaultCategories } from '@/types/degreeCompass';
import type { DegreeRequirementCategory } from '@/types/degreeCompass';

const inputClass =
  'w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary';

export interface DegreeSetupValues {
  majorName: string;
  minorName?: string;
  categories: DegreeRequirementCategory[];
}

export interface DegreeSetupFormProps {
  onSubmit: (values: DegreeSetupValues) => Promise<void>;
}

export function DegreeSetupForm({ onSubmit }: DegreeSetupFormProps) {
  const [majorName, setMajorName] = useState('');
  const [hasMinor, setHasMinor] = useState(false);
  const [minorName, setMinorName] = useState('');
  const [categories, setCategories] = useState<DegreeRequirementCategory[]>(() =>
    buildDefaultCategories(false),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleMinor = (checked: boolean) => {
    setHasMinor(checked);
    setCategories(buildDefaultCategories(checked));
  };

  const updateCategoryCredits = (id: string, creditsRequired: number) => {
    setCategories((prev) => prev.map((cat) => (cat.id === id ? { ...cat, creditsRequired } : cat)));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!majorName.trim()) {
      setError('Your major is required.');
      return;
    }
    if (hasMinor && !minorName.trim()) {
      setError('Enter your minor, or uncheck "I have a minor".');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        majorName: majorName.trim(),
        minorName: hasMinor ? minorName.trim() : undefined,
        categories,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not set up Degree Compass.');
    } finally {
      setSaving(false);
    }
  };

  const totalCredits = categories.reduce((sum, c) => sum + c.creditsRequired, 0);

  return (
    <Card className="rounded-2xl p-6 space-y-5 max-w-xl">
      <div>
        <h2 className="text-base font-bold text-foreground">Set up Degree Compass</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Track your progress toward graduation across every term - past, current, and planned.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="degree-setup-major" className="text-xs font-medium text-foreground">
            Major
          </label>
          <input
            id="degree-setup-major"
            value={majorName}
            onChange={(e) => setMajorName(e.target.value)}
            className={inputClass}
            placeholder="Computer Science"
            autoFocus
          />
        </div>

        <div className="space-y-1.5">
          <label className="flex items-center gap-2 text-xs font-medium text-foreground">
            <input
              type="checkbox"
              checked={hasMinor}
              onChange={(e) => toggleMinor(e.target.checked)}
              className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
            />
            I have a minor
          </label>
          {hasMinor && (
            <input
              id="degree-setup-minor"
              value={minorName}
              onChange={(e) => setMinorName(e.target.value)}
              className={inputClass}
              placeholder="Mathematics"
            />
          )}
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium text-foreground">
            Requirement categories ({totalCredits} credits total)
          </p>
          <p className="text-xs text-muted-foreground">
            These are a starting point - you can adjust the credit targets to match your
            program&rsquo;s actual requirements.
          </p>
          <ul className="space-y-2">
            {categories.map((cat) => (
              <li
                key={cat.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
              >
                <span className="text-sm text-foreground">{cat.name}</span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={cat.creditsRequired}
                    onChange={(e) => updateCategoryCredits(cat.id, Number(e.target.value))}
                    className="w-20 rounded-lg border border-border bg-input px-2 py-1.5 text-sm text-foreground text-right focus:outline-none focus:ring-2 focus:ring-primary"
                    aria-label={`Credits required for ${cat.name}`}
                  />
                  <span className="text-xs text-muted-foreground">credits</span>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {error && (
          <div className="rounded-lg border border-load-critical/30 bg-load-critical/10 px-3 py-2 text-sm text-load-critical">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {saving ? 'Setting up…' : 'Start tracking my degree'}
        </button>
      </form>
    </Card>
  );
}
