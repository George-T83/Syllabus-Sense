'use client';

import React, { useState, useMemo } from 'react';
import { Card } from '@/components/ui/Card';
import { analyzeSyllabusRevision, PolicyChange, PolicyDiffReport } from '@/lib/syllabus/diffEngine';

export interface SyllabusDiffModalProps {
  courseCode?: string;
  courseTitle?: string;
  originalSyllabusText: string;
  revisedSyllabusText: string;
  isOpen: boolean;
  onClose: () => void;
  onApplyChanges?: (selectedChanges: PolicyChange[]) => void;
}

export function SyllabusDiffModal({
  courseCode = 'CS 301',
  courseTitle = 'Data Structures',
  originalSyllabusText,
  revisedSyllabusText,
  isOpen,
  onClose,
  onApplyChanges,
}: SyllabusDiffModalProps) {
  const [activeTab, setActiveTab] = useState<'summary' | 'diff'>('summary');
  const [selectedChangeIds, setSelectedChangeIds] = useState<Set<string>>(new Set());
  const [diffFilter, setDiffFilter] = useState<'all' | 'changes-only'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const report: PolicyDiffReport = useMemo(() => {
    return analyzeSyllabusRevision(originalSyllabusText, revisedSyllabusText);
  }, [originalSyllabusText, revisedSyllabusText]);

  // Pre-select all detected changes on load
  React.useEffect(() => {
    if (report.changes.length > 0) {
      setSelectedChangeIds(new Set(report.changes.map((c) => c.id)));
    }
  }, [report]);

  if (!isOpen) return null;

  const toggleSelectChange = (id: string) => {
    setSelectedChangeIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    setSelectedChangeIds(new Set(report.changes.map((c) => c.id)));
  };

  const handleDeselectAll = () => {
    setSelectedChangeIds(new Set());
  };

  const handleApply = () => {
    const selected = report.changes.filter((c) => selectedChangeIds.has(c.id));
    onApplyChanges?.(selected);
    onClose();
  };

  const filteredDiffLines = report.lines.filter((line) => {
    if (diffFilter === 'changes-only' && line.type === 'unchanged') return false;
    if (searchQuery.trim()) {
      return line.content.toLowerCase().includes(searchQuery.toLowerCase());
    }
    return true;
  });

  const severityBadgeClass = (severity: 'major' | 'moderate' | 'minor') =>
    severity === 'major'
      ? 'bg-load-critical/10 text-load-critical border-load-critical/30'
      : severity === 'moderate'
        ? 'bg-load-medium/10 text-load-medium border-load-medium/30'
        : 'bg-load-low/10 text-load-low border-load-low/30';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="syllabus-diff-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/40 backdrop-blur-sm"
    >
      <Card className="relative w-full max-w-4xl p-5 sm:p-7 space-y-5 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4 shrink-0">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary/10 text-primary border border-primary/30">
                {courseCode}
              </span>
              <span className="text-xs text-muted-foreground font-medium">{courseTitle}</span>
              <h3 id="syllabus-diff-title" className="text-lg sm:text-xl font-bold text-foreground">
                Syllabus Policy Revision Diff
              </h3>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider border ${severityBadgeClass(
                  report.overallSeverity,
                )}`}
              >
                {report.overallSeverity} Revision
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Comparing original version against newly uploaded syllabus document.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="text-load-low font-bold">+{report.totalAdditions}</span>
              <span className="text-muted-foreground">/</span>
              <span className="text-load-critical font-bold">-{report.totalDeletions}</span>
            </div>
            <button
              onClick={onClose}
              aria-label="Close diff modal"
              className="p-2 text-muted-foreground hover:text-foreground rounded-xl hover:bg-muted transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
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
        </div>

        {/* Tab Controls */}
        <div className="flex items-center justify-between gap-3 shrink-0 flex-wrap">
          <div className="flex items-center rounded-xl bg-muted/50 p-1 border border-border">
            <button
              onClick={() => setActiveTab('summary')}
              data-testid="tab-summary"
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer min-h-[38px] ${
                activeTab === 'summary'
                  ? 'bg-primary text-primary-foreground shadow-md'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Detected Policy Changes ({report.changes.length})
            </button>
            <button
              onClick={() => setActiveTab('diff')}
              data-testid="tab-diff"
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer min-h-[38px] ${
                activeTab === 'diff'
                  ? 'bg-primary text-primary-foreground shadow-md'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Side-by-Side Line Diff
            </button>
          </div>

          {activeTab === 'summary' ? (
            <div className="flex items-center gap-2">
              <button
                onClick={handleSelectAll}
                className="text-xs text-primary hover:opacity-80 font-medium px-2 py-1 cursor-pointer"
              >
                Select All
              </button>
              <span className="text-border">|</span>
              <button
                onClick={handleDeselectAll}
                className="text-xs text-muted-foreground hover:text-foreground font-medium px-2 py-1 cursor-pointer"
              >
                Deselect All
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Filter lines..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Filter diff lines"
                className="px-3 py-1.5 rounded-lg bg-background border border-border text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <button
                onClick={() => setDiffFilter((f) => (f === 'all' ? 'changes-only' : 'all'))}
                className="px-3 py-1.5 rounded-lg bg-muted text-xs font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                {diffFilter === 'all' ? 'Show Changes Only' : 'Show All Lines'}
              </button>
            </div>
          )}
        </div>

        {/* Main Content Area (Scrollable) */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {activeTab === 'summary' ? (
            report.changes.length === 0 ? (
              <div className="p-8 text-center rounded-2xl bg-muted/30 border border-border space-y-2">
                <svg
                  className="w-8 h-8 text-load-low mx-auto"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <p className="text-sm font-semibold text-foreground">
                  No Policy Alterations Detected
                </p>
                <p className="text-xs text-muted-foreground">
                  The uploaded syllabus matches the existing course schedule and policy structure.
                </p>
              </div>
            ) : (
              report.changes.map((change) => {
                const isSelected = selectedChangeIds.has(change.id);
                return (
                  <div
                    key={change.id}
                    data-testid={`policy-change-card-${change.id}`}
                    onClick={() => toggleSelectChange(change.id)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer space-y-3 ${
                      isSelected
                        ? 'bg-primary/5 border-primary/50 shadow-lg'
                        : 'bg-muted/20 border-border hover:border-muted-foreground/30 opacity-75'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectChange(change.id)}
                          aria-label={`Select ${change.title}`}
                          className="mt-1 w-4 h-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
                        />
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-sm font-bold text-foreground">{change.title}</h4>
                            <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-muted text-primary border border-border">
                              {change.section}
                            </span>
                            <span
                              className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${severityBadgeClass(
                                change.severity,
                              )}`}
                            >
                              {change.severity}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">{change.summary}</p>
                        </div>
                      </div>
                    </div>

                    {(change.oldSnippet || change.newSnippet) && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono pt-1">
                        {change.oldSnippet && (
                          <div className="p-2.5 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive">
                            <span className="font-bold block text-[10px] uppercase tracking-wider text-destructive mb-1">
                              Previous Version:
                            </span>
                            <span className="line-through">{change.oldSnippet}</span>
                          </div>
                        )}
                        {change.newSnippet && (
                          <div className="p-2.5 rounded-xl bg-load-low/10 border border-load-low/30 text-load-low">
                            <span className="font-bold block text-[10px] uppercase tracking-wider text-load-low mb-1">
                              Revised Version:
                            </span>
                            <span>{change.newSnippet}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )
          ) : (
            <div
              data-testid="diff-lines-container"
              className="p-4 rounded-2xl bg-muted/20 border border-border font-mono text-xs overflow-x-auto space-y-0.5 max-h-[50vh]"
            >
              {filteredDiffLines.map((line, idx) => (
                <div
                  key={idx}
                  className={`flex items-start gap-3 px-2 py-1 rounded transition-colors ${
                    line.type === 'added'
                      ? 'bg-load-low/10 text-load-low border-l-2 border-load-low'
                      : line.type === 'removed'
                        ? 'bg-destructive/10 text-destructive line-through border-l-2 border-destructive'
                        : 'text-muted-foreground hover:bg-muted/40'
                  }`}
                >
                  <span className="w-8 shrink-0 text-[10px] text-muted-foreground text-right select-none">
                    {line.newLineNumber || line.oldLineNumber || ''}
                  </span>
                  <span className="w-4 shrink-0 font-bold select-none">
                    {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
                  </span>
                  <span className="flex-1 whitespace-pre-wrap">{line.content || ' '}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between gap-4 border-t border-border pt-4 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted text-sm font-medium transition-colors cursor-pointer min-h-[44px]"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleApply}
            data-testid="apply-diff-btn"
            disabled={selectedChangeIds.size === 0}
            className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-primary hover:opacity-90 disabled:bg-muted disabled:text-muted-foreground text-primary-foreground text-sm font-semibold transition-all shadow-lg shadow-primary/20 active:scale-95 cursor-pointer min-h-[44px]"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            <span>Apply Selected Updates ({selectedChangeIds.size})</span>
          </button>
        </div>
      </Card>
    </div>
  );
}
