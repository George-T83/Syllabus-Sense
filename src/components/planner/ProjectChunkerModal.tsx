'use client';

import { useState, useMemo } from 'react';
import { divideProjectIntoChunks, type ChunkableType, type ProjectChunk } from '@/lib/planner/projectChunker';
import { createScheduleItem } from '@/lib/firestore/scheduleItems';
import { useAppState } from '@/context/AppStateContext';
import { useAuth } from '@/context/AuthContext';
import { useModalA11y } from '@/hooks/useModalA11y';
import type { ScheduleItem, AssignmentType, Course } from '@/types/schedule';

export interface ProjectChunkerModalProps {
  open?: boolean;
  isOpen?: boolean;
  onClose: () => void;
  courses?: Course[];
  onSaveChunks?: (chunks: ProjectChunk[]) => Promise<void>;
  initialTargetType?: ChunkableType;
}

const TYPE_CONFIG: Record<ChunkableType, { label: string; icon: string; defaultHours: number; defaultTitle: string }> = {
  project: { label: 'Final Project / Capstone', icon: '🚀', defaultHours: 10, defaultTitle: 'Senior Capstone Project' },
  exam: { label: 'Exam Study Plan', icon: '📝', defaultHours: 8, defaultTitle: 'Midterm Exam 1 Prep' },
  quiz: { label: 'Quiz / Test Review', icon: '⚡', defaultHours: 3, defaultTitle: 'Chapter Quiz Review' },
  assignment: { label: 'Large Assignment / Lab', icon: '📚', defaultHours: 5, defaultTitle: 'Lab Report & Data Analysis' },
  paper: { label: 'Essay / Term Paper', icon: '📄', defaultHours: 7, defaultTitle: 'Term Research Paper' },
  presentation: { label: 'Presentation / Slides', icon: '🎤', defaultHours: 6, defaultTitle: 'Class Slide Presentation' },
  reading: { label: 'Textbook / Lit Reading', icon: '📖', defaultHours: 4, defaultTitle: 'Chapters 4-6 Required Reading' },
  coding: { label: 'Coding / Repository', icon: '💻', defaultHours: 12, defaultTitle: 'Full-Stack Software Project' },
  portfolio: { label: 'Design Portfolio', icon: '🎨', defaultHours: 8, defaultTitle: 'Portfolio Case Study' },
  group: { label: 'Group Project', icon: '👥', defaultHours: 9, defaultTitle: 'Group Capstone Project' },
  flashcards: { label: 'Flashcard Mastery', icon: '🃏', defaultHours: 3, defaultTitle: 'Key Definitions Deck' },
  case_study: { label: 'Case Study Analysis', icon: '🔬', defaultHours: 6, defaultTitle: 'Business Case Study Audit' },
};

export function ProjectChunkerModal({
  open,
  isOpen,
  onClose,
  courses,
  onSaveChunks,
  initialTargetType = 'project',
}: ProjectChunkerModalProps) {
  const isModalOpen = open ?? isOpen ?? false;
  const { state, dispatch } = useAppState();
  const { user } = useAuth();

  const [chunkType, setChunkType] = useState<ChunkableType>(initialTargetType);
  const [projectTitle, setProjectTitle] = useState(() => TYPE_CONFIG[initialTargetType]?.defaultTitle || 'Senior Capstone Project');
  const [totalHours, setTotalHours] = useState(() => TYPE_CONFIG[initialTargetType]?.defaultHours || 10);
  const [dueDateStr, setDueDateStr] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 10);
    return d.toISOString().split('T')[0];
  });
  const [pace, setPace] = useState<'daily' | 'weekly'>('daily');
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const dialogRef = useModalA11y<HTMLDivElement>(isModalOpen, onClose);
  const availableCourses = courses || state.courses;

  const handleSelectType = (type: ChunkableType) => {
    setChunkType(type);
    const cfg = TYPE_CONFIG[type];
    setTotalHours(cfg.defaultHours);
    setProjectTitle(cfg.defaultTitle);
  };

  const dueDateObj = useMemo(() => new Date(dueDateStr), [dueDateStr]);

  const previewChunks = useMemo(() => {
    if (!projectTitle.trim() || totalHours <= 0) return [];
    return divideProjectIntoChunks({
      projectTitle: projectTitle.trim(),
      totalEstimatedHours: totalHours,
      dueDate: dueDateObj,
      pace,
      type: chunkType,
    });
  }, [projectTitle, totalHours, dueDateObj, pace, chunkType]);

  if (!isModalOpen) return null;

  const handlePersistChunks = async () => {
    if (!user || previewChunks.length === 0) return;
    setSaving(true);
    try {
      if (onSaveChunks) {
        await onSaveChunks(previewChunks);
      } else {
        for (const chunk of previewChunks) {
          const mappedType: AssignmentType =
            chunkType === 'exam'
              ? 'exam'
              : chunkType === 'quiz'
              ? 'quiz'
              : chunkType === 'reading'
              ? 'reading'
              : chunkType === 'project' || chunkType === 'coding' || chunkType === 'portfolio' || chunkType === 'group'
              ? 'project'
              : 'assignment';

          const itemData: ScheduleItem = {
            id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            title: chunk.title,
            courseId: selectedCourseId || availableCourses[0]?.id || 'course-gen',
            type: mappedType,
            dueDate: chunk.targetDate,
            estimatedHours: chunk.durationMinutes / 60,
            completed: false,
            priority: 'high',
            notes: `Auto-generated bite-sized chunk (${chunk.phase}) from Study & Project Chunker.`,
          };

          await createScheduleItem(user.uid, itemData, dispatch);
        }
      }
      setSavedSuccess(true);
      setTimeout(() => {
        setSavedSuccess(false);
        onClose();
      }, 1200);
    } catch (err) {
      console.error('Failed to save study chunks:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="project-chunker-title"
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-2xl transition-all"
      >
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <div>
              <h2 id="project-chunker-title" className="text-lg font-bold text-foreground">
                Study &amp; Project Bite-Sized Chunker
              </h2>
              <p className="text-xs text-muted-foreground">
                Divide projects, exams, quizzes, coding tasks, papers, readings, and presentations into daily chunks
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            ✕
          </button>
        </div>

        <div className="mt-5 space-y-4">
          {/* 12 Target Type selector grid */}
          <div>
            <label className="text-xs font-semibold text-foreground">Select Target Type (12 Categories Available)</label>
            <div className="mt-1.5 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {(Object.keys(TYPE_CONFIG) as ChunkableType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => handleSelectType(t)}
                  className={`flex items-center gap-1.5 rounded-xl border p-2.5 text-left text-xs font-semibold transition-all ${
                    chunkType === t
                      ? 'border-primary bg-primary/10 text-primary shadow-sm'
                      : 'border-border bg-background text-muted-foreground hover:bg-accent'
                  }`}
                >
                  <span className="text-sm">{TYPE_CONFIG[t].icon}</span>
                  <span className="truncate">{TYPE_CONFIG[t].label}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-foreground">Title / Subject</label>
            <input
              type="text"
              value={projectTitle}
              onChange={(e) => setProjectTitle(e.target.value)}
              className="mt-1 w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="text-xs font-semibold text-foreground">Estimated Total Hours</label>
              <input
                type="number"
                min={1}
                max={100}
                value={totalHours}
                onChange={(e) => setTotalHours(Number(e.target.value))}
                className="mt-1 w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground">Target Date / Exam Date</label>
              <input
                type="date"
                value={dueDateStr}
                onChange={(e) => setDueDateStr(e.target.value)}
                className="mt-1 w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground">Target Course</label>
              <select
                value={selectedCourseId}
                onChange={(e) => setSelectedCourseId(e.target.value)}
                className="mt-1 w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">General / Independent</option>
                {state.courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} — {c.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-foreground">Pacing Preference</label>
            <div className="mt-1.5 flex gap-3">
              <button
                type="button"
                onClick={() => setPace('daily')}
                className={`flex-1 rounded-xl border px-4 py-2.5 text-xs font-semibold transition-all ${
                  pace === 'daily'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-background text-muted-foreground hover:bg-accent'
                }`}
              >
                📅 Daily Bite Chunks (30–60 min/day)
              </button>
              <button
                type="button"
                onClick={() => setPace('weekly')}
                className={`flex-1 rounded-xl border px-4 py-2.5 text-xs font-semibold transition-all ${
                  pace === 'weekly'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-background text-muted-foreground hover:bg-accent'
                }`}
              >
                📆 Weekly Major Milestones
              </button>
            </div>
          </div>

          <div className="mt-6 border-t border-border pt-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Generated Bite-Sized Study Schedule ({previewChunks.length} Chunks)
            </h3>

            <div className="mt-3 max-h-60 space-y-2 overflow-y-auto pr-1">
              {previewChunks.map((chunk, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/30 p-3 text-xs"
                >
                  <div className="space-y-0.5 min-w-0 pr-2">
                    <span className="inline-block rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                      {chunk.phase}
                    </span>
                    <p className="font-semibold text-foreground truncate">{chunk.title}</p>
                    <p className="text-[11px] text-muted-foreground">Target Date: {chunk.targetDate}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className="rounded-lg bg-accent px-2.5 py-1 text-[11px] font-bold text-foreground">
                      ⏱ {chunk.durationMinutes} mins
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
          <p className="text-xs text-muted-foreground">
            Total Work: <span className="font-bold text-foreground">{totalHours} hrs</span> spread across{' '}
            <span className="font-bold text-foreground">{previewChunks.length} sessions</span>
          </p>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded-xl border border-border px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-accent"
            >
              Cancel
            </button>
            <button
              onClick={handlePersistChunks}
              disabled={saving || savedSuccess || previewChunks.length === 0}
              className="rounded-xl bg-primary px-5 py-2 text-xs font-bold text-primary-foreground shadow-md transition-all hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? 'Adding to Schedule...' : savedSuccess ? '✓ Chunks Added!' : 'Add Chunks to Task List'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
