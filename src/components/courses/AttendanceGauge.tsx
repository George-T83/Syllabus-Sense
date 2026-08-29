'use client';

import React, { useState, useMemo } from 'react';
import { Card } from '@/components/ui/Card';

export interface AbsenceRecord {
  id: string;
  date: string; // YYYY-MM-DD
  type: 'excused' | 'unexcused';
  reason?: string;
  note?: string;
}

export interface AttendanceGaugeProps {
  courseCode?: string;
  courseTitle?: string;
  maxAllowedAbsences?: number;
  penaltyDescription?: string;
  initialAbsences?: AbsenceRecord[];
  onAbsenceLogged?: (record: AbsenceRecord) => void;
  onAbsenceDeleted?: (id: string) => void;
}

const DEFAULT_ABSENCES: AbsenceRecord[] = [
  {
    id: 'abs-1',
    date: '2026-09-14',
    type: 'unexcused',
    reason: 'Overslept / Traffic',
    note: 'Missed Lecture 4',
  },
  {
    id: 'abs-2',
    date: '2026-10-02',
    type: 'excused',
    reason: 'Doctor Appointment',
    note: 'Doctor note submitted to professor',
  },
];

export function AttendanceGauge({
  courseCode = 'CS 301',
  courseTitle = 'Data Structures & Algorithms',
  maxAllowedAbsences = 3,
  penaltyDescription = 'Each unexcused absence beyond 3 incurs a 3% deduction from the final grade.',
  initialAbsences = DEFAULT_ABSENCES,
  onAbsenceLogged,
  onAbsenceDeleted,
}: AttendanceGaugeProps) {
  const [absences, setAbsences] = useState<AbsenceRecord[]>(initialAbsences);
  const [isLoggingModalOpen, setIsLoggingModalOpen] = useState(false);
  const [newDate, setNewDate] = useState('2026-10-15');
  const [newType, setNewType] = useState<'excused' | 'unexcused'>('unexcused');
  const [newReason, setNewReason] = useState('');
  const [newNote, setNewNote] = useState('');

  const unexcusedCount = useMemo(() => {
    return absences.filter((a) => a.type === 'unexcused').length;
  }, [absences]);

  const excusedCount = useMemo(() => {
    return absences.filter((a) => a.type === 'excused').length;
  }, [absences]);

  const remainingAllowed = Math.max(0, maxAllowedAbsences - unexcusedCount);
  const excessAbsences = Math.max(0, unexcusedCount - maxAllowedAbsences);

  const status = useMemo<'safe' | 'warning' | 'critical'>(() => {
    if (unexcusedCount >= maxAllowedAbsences) return 'critical';
    if (remainingAllowed === 1) return 'warning';
    return 'safe';
  }, [unexcusedCount, maxAllowedAbsences, remainingAllowed]);

  // SVG circular gauge math
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const progressRatio = Math.min(1, unexcusedCount / Math.max(1, maxAllowedAbsences));
  const strokeDashoffset = circumference - progressRatio * circumference;

  const handleAddAbsence = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDate) return;

    const record: AbsenceRecord = {
      id: `abs-${Date.now()}`,
      date: newDate,
      type: newType,
      reason: newReason.trim() || undefined,
      note: newNote.trim() || undefined,
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
    <div className="space-y-6 w-full max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary/10 text-primary border border-primary/30">
              {courseCode}
            </span>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              Attendance & Absence Allowance Gauge
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            {courseTitle} — Track unexcused absences against syllabus policy thresholds.
          </p>
        </div>

        <button
          onClick={() => setIsLoggingModalOpen(true)}
          data-testid="log-absence-open-btn"
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary hover:opacity-90 text-primary-foreground text-xs font-semibold shadow-lg shadow-primary/20 active:scale-95 transition-all cursor-pointer min-h-[44px]"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          <span>Log Absence</span>
        </button>
      </div>

      {/* Main Gauge & Policy Status Card */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Left Side: Circular Gauge (5 cols) */}
        <Card className="md:col-span-5 p-6 flex flex-col items-center justify-center space-y-4">
          <div className="relative flex items-center justify-center">
            <svg
              className="w-44 h-44 transform -rotate-90"
              viewBox="0 0 140 140"
              role="progressbar"
              aria-valuenow={unexcusedCount}
              aria-valuemin={0}
              aria-valuemax={maxAllowedAbsences}
              aria-label={`Unexcused absences: ${unexcusedCount} of ${maxAllowedAbsences}`}
            >
              {/* Background Track */}
              <circle
                cx="70"
                cy="70"
                r={radius}
                className="stroke-slate-200 dark:stroke-slate-800"
                strokeWidth="10"
                fill="transparent"
              />
              {/* Active Progress */}
              <circle
                cx="70"
                cy="70"
                r={radius}
                className={`transition-all duration-700 ease-out ${
                  status === 'critical'
                    ? 'stroke-load-critical'
                    : status === 'warning'
                      ? 'stroke-load-medium'
                      : 'stroke-load-low'
                }`}
                strokeWidth="10"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                fill="transparent"
              />
            </svg>

            {/* Central Badge */}
            <div className="absolute flex flex-col items-center justify-center text-center">
              <span className="text-3xl font-extrabold text-foreground tracking-tight">
                {unexcusedCount}
                <span className="text-base font-medium text-muted-foreground">
                  /{maxAllowedAbsences}
                </span>
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Unexcused
              </span>
            </div>
          </div>

          <div className="text-center space-y-1">
            <span
              data-testid="absence-status-badge"
              className={`inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${
                status === 'safe'
                  ? 'bg-load-low/10 text-load-low border-load-low/30'
                  : status === 'warning'
                    ? 'bg-load-medium/10 text-load-medium border-load-medium/30'
                    : 'bg-load-critical/10 text-load-critical border-load-critical/30'
              }`}
            >
              {status === 'safe'
                ? `${remainingAllowed} of ${maxAllowedAbsences} Absences Remaining`
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
        </Card>

        {/* Right Side: Policy Details & Advice (7 cols) */}
        <Card className="md:col-span-7 p-6 space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-primary font-semibold text-sm">
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                />
              </svg>
              <span>Syllabus Attendance Policy Rules</span>
            </div>

            <div className="p-4 rounded-2xl bg-muted/50 border border-border text-xs text-foreground space-y-2">
              <p className="leading-relaxed font-mono">&ldquo;{penaltyDescription}&rdquo;</p>
              <div className="pt-2 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground">
                <span>
                  Allowed Unexcused: <strong>{maxAllowedAbsences}</strong>
                </span>
                <span>
                  Current Unexcused: <strong className="text-foreground">{unexcusedCount}</strong>
                </span>
              </div>
            </div>
          </div>

          <div
            className={`p-4 rounded-2xl border text-xs space-y-1 ${
              status === 'safe'
                ? 'bg-load-low/10 border-load-low/30 text-load-low'
                : status === 'warning'
                  ? 'bg-load-medium/10 border-load-medium/30 text-load-medium'
                  : 'bg-load-critical/10 border-load-critical/30 text-load-critical'
            }`}
          >
            <div className="font-bold flex items-center gap-1.5">
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
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span>Attendance Advisory</span>
            </div>
            <p>
              {status === 'safe'
                ? `You are in good standing. You can miss ${remainingAllowed} more classes without any academic penalty.`
                : status === 'warning'
                  ? 'Caution: You have used 2 absences. Missing one more class will trigger automatic grade deductions.'
                  : 'Warning: You have reached or exceeded the allowed absences. Contact your professor or submit medical documentation.'}
            </p>
          </div>
        </Card>
      </div>

      {/* Logged Absences Table */}
      <Card className="p-6 space-y-4">
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
                    <td className="px-4 py-3 font-mono font-medium text-foreground">{rec.date}</td>
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
      </Card>

      {/* Log Absence Modal */}
      {isLoggingModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="log-absence-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
        >
          <Card className="relative w-full max-w-md p-6 space-y-4">
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
    </div>
  );
}
