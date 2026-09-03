'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { useModalA11y } from '@/hooks/useModalA11y';
import { toDayKey } from '@/lib/calendar/dates';
import type { Contact } from '@/types/schedule';

export interface ScheduleOfficeVisitModalProps {
  contact: Contact | null;
  onClose: () => void;
  onSchedule: (contact: Contact, dateKey: string) => Promise<void>;
}

/** Books a one-off reminder task tied to a contact: an office-hours visit
 * for a professor/TA, or a study session for a classmate. Same modal, same
 * flow either way - only the copy changes based on `contact.role`. */
export function ScheduleOfficeVisitModal({
  contact,
  onClose,
  onSchedule,
}: ScheduleOfficeVisitModalProps) {
  const today = toDayKey(new Date());
  const [date, setDate] = useState(today);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const open = !!contact;
  const dialogRef = useModalA11y<HTMLDivElement>(open, onClose);

  useEffect(() => {
    if (!open) return;
    setDate(today);
    setSubmitError(null);
    // `today` intentionally excluded - it should only reset when a new
    // contact opens the modal, not tick over if the modal is left open
    // across midnight.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, contact]);

  if (!contact) return null;

  const isClassmate = contact.role === 'classmate';

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitting(true);
    try {
      await onSchedule(contact, date);
      onClose();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to schedule. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="schedule-visit-title"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="w-full max-w-md outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <Card accent="none">
          <CardHeader>
            <CardTitle id="schedule-visit-title">
              {isClassmate ? 'Schedule a Study Session' : 'Schedule a Visit'}
            </CardTitle>
            <CardDescription>Adds a reminder task to your Tasks list.</CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              {submitError && (
                <div className="rounded-lg border border-load-critical/30 bg-load-critical/10 px-3 py-2 text-sm text-load-critical">
                  {submitError}
                </div>
              )}

              <div className="rounded-xl border border-border bg-muted/50 p-3 text-sm">
                <div className="font-semibold text-foreground">{contact.fullName}</div>
                {contact.officeHours && (
                  <div className="mt-1 text-xs text-muted-foreground">
                    Office hours: {contact.officeHours}
                  </div>
                )}
                {contact.officeLocation && (
                  <div className="text-xs text-muted-foreground">{contact.officeLocation}</div>
                )}
              </div>

              <div>
                <label
                  htmlFor="visit-date"
                  className="block text-xs font-semibold text-muted-foreground mb-1"
                >
                  {isClassmate ? 'Which day are you meeting?' : 'Which day are you going?'}
                </label>
                <input
                  id="visit-date"
                  type="date"
                  value={date}
                  min={today}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  className="w-full min-h-[44px] rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </CardContent>

            <div className="flex items-center justify-end gap-2 border-t border-border p-4">
              <button
                type="button"
                onClick={onClose}
                className="inline-flex min-h-[44px] items-center justify-center rounded-lg px-4 text-sm font-semibold text-muted-foreground transition-colors hover:bg-accent"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting
                  ? 'Scheduling...'
                  : isClassmate
                    ? 'Schedule Study Session'
                    : 'Schedule Visit'}
              </button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
