'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { CardActionButton } from '@/components/ui/CardAction';
import { RingGauge, type RingGaugeLevel } from '@/components/ui/RingGauge';
import type { AbsenceRecord, AttendancePolicy } from '@/types/schedule';

export type { AbsenceRecord };

export interface AttendanceGaugeProps {
  courseCode?: string;
  courseTitle?: string;
  /** Unexcused absences the syllabus allows - from the course's saved
   * attendance policy. Undefined when none is on file: the card then says
   * so and never assumes a limit. */
  maxAllowedAbsences?: number;
  /** What the syllabus says happens past the limit, as the student entered it. */
  penaltyDescription?: string;
  initialAbsences?: AbsenceRecord[];
  onAbsenceLogged?: (record: AbsenceRecord) => void;
  onAbsenceDeleted?: (id: string) => void;
  /** Saves the policy the student enters from their syllabus. Without it the
   * card is read-only about policy. */
  onPolicyChange?: (policy: AttendancePolicy) => void;
}

/** A stable empty default: a fresh `[]` per render would re-fire the sync
 * effect below on every render and loop forever. */
const NO_ABSENCES: AbsenceRecord[] = [];

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function AttendanceGauge({
  courseCode,
  courseTitle,
  maxAllowedAbsences,
  penaltyDescription,
  initialAbsences = NO_ABSENCES,
  onAbsenceLogged,
  onAbsenceDeleted,
  onPolicyChange,
}: AttendanceGaugeProps) {
  const hasLimit = typeof maxAllowedAbsences === 'number' && maxAllowedAbsences >= 0;
  const limit = hasLimit ? maxAllowedAbsences : 0;
  const [editingPolicy, setEditingPolicy] = useState(false);
  const [draftLimit, setDraftLimit] = useState(hasLimit ? String(maxAllowedAbsences) : '');
  const [draftPenalty, setDraftPenalty] = useState(penaltyDescription ?? '');
  const [absences, setAbsences] = useState<AbsenceRecord[]>(initialAbsences);

  // Course switches re-mount this component under a different key in
  // CourseDetailView, but keep this in sync if that ever changes -
  // otherwise switching courses without a remount would show stale data.
  useEffect(() => {
    setAbsences(initialAbsences);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialAbsences]);
  const [isLoggingModalOpen, setIsLoggingModalOpen] = useState(false);
  const [newDate, setNewDate] = useState(todayKey);
  const [newType, setNewType] = useState<'excused' | 'unexcused'>('unexcused');
  const [newReason, setNewReason] = useState('');
  const [newNote, setNewNote] = useState('');

  const unexcusedCount = useMemo(() => {
    return absences.filter((a) => a.type === 'unexcused').length;
  }, [absences]);

  const excusedCount = useMemo(() => {
    return absences.filter((a) => a.type === 'excused').length;
  }, [absences]);

  const remainingAllowed = Math.max(0, limit - unexcusedCount);
  const excessAbsences = Math.max(0, unexcusedCount - limit);

  const status = useMemo<'safe' | 'warning' | 'critical'>(() => {
    if (!hasLimit) return 'safe';
    if (unexcusedCount >= limit) return 'critical';
    if (remainingAllowed === 1) return 'warning';
    return 'safe';
  }, [hasLimit, unexcusedCount, limit, remainingAllowed]);

  const progressRatio = hasLimit ? Math.min(1, unexcusedCount / Math.max(1, limit)) : 0;

  const handleSavePolicy = (e: React.FormEvent) => {
    e.preventDefault();
    const n = Number(draftLimit);
    if (draftLimit.trim() === '' || !Number.isInteger(n) || n < 0) return;
    onPolicyChange?.({
      allowedUnexcused: n,
      ...(draftPenalty.trim() ? { penalty: draftPenalty.trim() } : {}),
    });
    setEditingPolicy(false);
  };
  const gaugeLevel: RingGaugeLevel =
    status === 'critical' ? 'critical' : status === 'warning' ? 'medium' : 'low';

  const handleAddAbsence = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDate) return;

    const record: AbsenceRecord = {
      id: `abs-${Date.now()}`,
      date: newDate,
      type: newType,
      // Omit reason/note entirely when blank rather than setting them to
      // `undefined` - Firestore's setDoc/updateDoc rejects a field whose
      // value is literally `undefined` (this record used to be local-only
      // React state, so that never mattered until it started getting
      // persisted via onAbsenceLogged).
      ...(newReason.trim() ? { reason: newReason.trim() } : {}),
      ...(newNote.trim() ? { note: newNote.trim() } : {}),
    };

    setAbsences((prev) => [record, ...prev]);
    onAbsenceLogged?.(record);
    setIsLoggingModalOpen(false);
    setNewReason('');
    setNewNote('');
  };

  const handleDeleteAbsence = (id: string) => {
    setAbsences((prev) => prev.filter((a) => a.id !== id));
    onAbsenceDeleted?.(id);
  };

  return (
    <>
      <Card className="rounded-2xl p-6 space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-foreground">Attendance</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {[courseCode, courseTitle].filter(Boolean).join(' · ')}
              {hasLimit
                ? ' — unexcused absences against your syllabus limit.'
                : ' — unexcused absences you have logged.'}
            </p>
          </div>
          <CardActionButton
            variant="solid"
            withPlus
            onClick={() => setIsLoggingModalOpen(true)}
            data-testid="log-absence-open-btn"
          >
            Log absence
          </CardActionButton>
        </div>

        {/* Main Gauge & Policy Status Card */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Left Side: Circular Gauge (5 cols) */}
          <div className="md:col-span-5 rounded-2xl border border-border bg-foreground/[0.025] p-5 flex flex-col items-center justify-center space-y-4">
            <RingGauge
              progress={progressRatio}
              level={gaugeLevel}
              size={176}
              radius={70}
              aria-label={
                hasLimit
                  ? `Unexcused absences: ${unexcusedCount} of ${limit}`
                  : `Unexcused absences: ${unexcusedCount}, no limit on file`
              }
              aria-valuenow={unexcusedCount}
              aria-valuemin={0}
              aria-valuemax={hasLimit ? limit : unexcusedCount}
            >
              <div className="flex flex-col items-center justify-center text-center">
                <span className="text-3xl font-extrabold text-foreground tracking-tight">
                  {unexcusedCount}
                  {hasLimit && (
                    <span className="text-base font-medium text-muted-foreground">/{limit}</span>
                  )}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Unexcused
                </span>
              </div>
            </RingGauge>

            <div className="text-center space-y-1">
              <span
                data-testid="absence-status-badge"
                className={`inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${
                  !hasLimit
                    ? 'bg-muted text-muted-foreground border-border'
                    : status === 'safe'
                      ? 'bg-load-low/10 text-load-low border-load-low/30'
                      : status === 'warning'
                        ? 'bg-load-medium/10 text-load-medium border-load-medium/30'
                        : 'bg-load-critical/10 text-load-critical border-load-critical/30'
                }`}
              >
                {!hasLimit
                  ? 'No limit on file'
                  : status === 'safe'
                    ? `${remainingAllowed} of ${limit} Absences Remaining`
                    : status === 'warning'
                      ? 'Final Warning: 1 Absence Left'
                      : excessAbsences > 0
                        ? `Penalty Active: +${excessAbsences} Over Limit`
                        : 'Limit Reached: 0 Remaining'}
              </span>
              <p className="text-xs text-muted-foreground">
                {excusedCount} excused {excusedCount === 1 ? 'absence' : 'absences'} logged (no
                penalty)
              </p>
            </div>
          </div>

          {/* Right Side: the policy as the student entered it, and advice
              only once there's a real limit to measure against. */}
          <div className="md:col-span-7 rounded-2xl border border-border bg-foreground/[0.025] p-5 space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-primary">Attendance policy</span>
                {onPolicyChange && hasLimit && !editingPolicy && (
                  <CardActionButton onClick={() => setEditingPolicy(true)}>Edit</CardActionButton>
                )}
              </div>

              {editingPolicy ? (
                <form
                  onSubmit={handleSavePolicy}
                  className="space-y-3"
                  aria-label="Attendance policy"
                >
                  <label className="block text-xs font-semibold text-foreground">
                    Unexcused absences allowed
                    <input
                      type="number"
                      min={0}
                      step={1}
                      required
                      value={draftLimit}
                      onChange={(e) => setDraftLimit(e.target.value)}
                      className="mt-1 block w-24 rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </label>
                  <label className="block text-xs font-semibold text-foreground">
                    What happens after that{' '}
                    <span className="font-normal text-muted-foreground">(optional)</span>
                    <input
                      type="text"
                      value={draftPenalty}
                      onChange={(e) => setDraftPenalty(e.target.value)}
                      placeholder="As your syllabus puts it"
                      className="mt-1 block w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <CardActionButton type="submit" variant="solid">
                      Save policy
                    </CardActionButton>
                    <CardActionButton onClick={() => setEditingPolicy(false)}>
                      Cancel
                    </CardActionButton>
                  </div>
                </form>
              ) : hasLimit ? (
                <div className="space-y-2 rounded-2xl border border-border bg-muted/50 p-4 text-xs text-foreground">
                  <p>
                    <strong>{limit}</strong> unexcused {limit === 1 ? 'absence' : 'absences'}{' '}
                    allowed
                    {penaltyDescription ? '. After that:' : '.'}
                  </p>
                  {penaltyDescription && (
                    <p className="leading-relaxed text-muted-foreground">{penaltyDescription}</p>
                  )}
                  <p className="border-t border-border pt-2 text-[11px] text-muted-foreground">
                    From your syllabus, as you entered it.
                  </p>
                </div>
              ) : (
                <div className="space-y-3 rounded-2xl border border-dashed border-border p-4 text-xs text-muted-foreground">
                  <p>
                    No attendance policy on file. Check your syllabus for how many absences are
                    allowed and what happens after that, and add it here. This card will then warn
                    you before an absence starts to cost you.
                  </p>
                  {onPolicyChange && (
                    <CardActionButton
                      variant="solid"
                      withPlus
                      onClick={() => setEditingPolicy(true)}
                    >
                      Add policy
                    </CardActionButton>
                  )}
                </div>
              )}
            </div>

            {hasLimit && !editingPolicy && (
              <div
                className={`p-4 rounded-2xl border text-xs space-y-1 ${
                  status === 'safe'
                    ? 'bg-load-low/10 border-load-low/30 text-load-low'
                    : status === 'warning'
                      ? 'bg-load-medium/10 border-load-medium/30 text-load-medium'
                      : 'bg-load-critical/10 border-load-critical/30 text-load-critical'
                }`}
              >
                <p className="font-bold">
                  {status === 'safe'
                    ? 'In good standing'
                    : status === 'warning'
                      ? 'Close to your limit'
                      : excessAbsences > 0
                        ? 'Over your limit'
                        : 'At your limit'}
                </p>
                <p>
                  {status === 'safe'
                    ? `By your policy, you can miss ${remainingAllowed} more ${remainingAllowed === 1 ? 'class' : 'classes'} before it applies.`
                    : status === 'warning'
                      ? `One more unexcused absence reaches your limit of ${limit}.`
                      : excessAbsences > 0
                        ? `You're ${excessAbsences} over your limit of ${limit}. Talk to your instructor, and log anything with documentation as excused.`
                        : `You've used all ${limit}. The next unexcused absence counts against you.`}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Logged Absences Table */}
        <div className="rounded-2xl border border-border bg-foreground/[0.025] p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">
              Absence History ({absences.length})
            </h3>
          </div>

          {absences.length === 0 ? (
            <div className="p-8 text-center rounded-2xl bg-muted/30 border border-border text-xs text-muted-foreground">
              No absences recorded. Perfect attendance!
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border bg-muted/20">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/80 text-muted-foreground font-semibold border-b border-border">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Classification</th>
                    <th className="px-4 py-3">Reason / Details</th>
                    <th className="px-4 py-3">Notes</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {absences.map((rec) => (
                    <tr
                      key={rec.id}
                      data-testid={`absence-row-${rec.id}`}
                      className="hover:bg-muted/40 transition-colors"
                    >
                      <td className="px-4 py-3 font-mono font-medium text-foreground">
                        {rec.date}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                            rec.type === 'excused'
                              ? 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/30'
                              : 'bg-load-critical/10 text-load-critical border-load-critical/30'
                          }`}
                        >
                          {rec.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-foreground/80">{rec.reason || '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground text-[11px]">
                        {rec.note || '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleDeleteAbsence(rec.id)}
                          aria-label={`Delete absence on ${rec.date}`}
                          className="p-1.5 text-muted-foreground hover:text-destructive rounded-lg hover:bg-muted transition-colors cursor-pointer"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>

      {/* Log Absence Modal */}
      {isLoggingModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="log-absence-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
        >
          <Card accent="none" opaque className="relative w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 id="log-absence-title" className="text-base font-bold text-foreground">
                Log Course Absence
              </h3>
              <button
                onClick={() => setIsLoggingModalOpen(false)}
                aria-label="Close log absence dialog"
                className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleAddAbsence} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Absence Date
                </label>
                <input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  required
                  aria-label="Absence Date"
                  className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Classification
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewType('unexcused')}
                    className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer min-h-[40px] ${
                      newType === 'unexcused'
                        ? 'bg-load-critical text-white shadow-md shadow-load-critical/20'
                        : 'bg-background text-muted-foreground border border-border'
                    }`}
                  >
                    Unexcused
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewType('excused')}
                    className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer min-h-[40px] ${
                      newType === 'excused'
                        ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/20'
                        : 'bg-background text-muted-foreground border border-border'
                    }`}
                  >
                    Excused
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Reason / Excuse
                </label>
                <input
                  type="text"
                  placeholder="e.g. Illness, Family Emergency, Interview"
                  value={newReason}
                  onChange={(e) => setNewReason(e.target.value)}
                  aria-label="Reason or excuse"
                  className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Private Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Doctor's note submitted via email"
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  aria-label="Private notes"
                  className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsLoggingModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-muted-foreground hover:text-foreground rounded-xl hover:bg-muted cursor-pointer min-h-[44px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  data-testid="submit-absence-btn"
                  className="px-5 py-2 text-xs font-semibold text-primary-foreground bg-primary hover:opacity-90 rounded-xl shadow-lg shadow-primary/20 cursor-pointer min-h-[44px]"
                >
                  Save Absence
                </button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </>
  );
}
