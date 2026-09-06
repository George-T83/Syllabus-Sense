'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/Toast';
import { useDegreeProfile, useDegreeCourses } from '@/lib/firestore/useDegreeCompass';
import {
  saveDegreeProfile,
  saveDegreeCourse,
  deleteDegreeCourse,
} from '@/lib/firestore/degreeCompass';
import { computeOverallProgress } from '@/lib/degreeCompass/progress';
import { DegreeSetupForm, type DegreeSetupValues } from './DegreeSetupForm';
import { DegreeCourseFormModal, type DegreeCourseFormValues } from './DegreeCourseFormModal';
import { CardActionButton } from '@/components/ui/CardAction';
import { PathView } from './PathView';
import { LedgerView } from './LedgerView';
import type { DegreeCourse } from '@/types/degreeCompass';
import { cn } from '@/lib/utils';

type ViewMode = 'path' | 'ledger';

export function DegreeCompassView() {
  const { user } = useAuth();
  const { showError, showSuccess } = useToast();
  const { profile, loading } = useDegreeProfile(user?.uid);
  const courses = useDegreeCourses(user?.uid);

  const [viewMode, setViewMode] = useState<ViewMode>('path');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<DegreeCourse | undefined>(undefined);

  const handleSetupSubmit = async (values: DegreeSetupValues) => {
    if (!user) throw new Error('You must be signed in.');
    try {
      await saveDegreeProfile(user.uid, values);
    } catch (err) {
      showError("Couldn't set up Degree Compass", 'Please try again.');
      throw err;
    }
  };

  const openAddCourse = () => {
    setEditingCourse(undefined);
    setModalOpen(true);
  };

  const openEditCourse = (course: DegreeCourse) => {
    setEditingCourse(course);
    setModalOpen(true);
  };

  const handleCourseSubmit = async (values: DegreeCourseFormValues) => {
    if (!user) throw new Error('You must be signed in.');
    try {
      await saveDegreeCourse(user.uid, { ...values, id: editingCourse?.id });
      showSuccess(editingCourse ? 'Course updated' : 'Course added');
    } catch (err) {
      showError("Couldn't save that course", 'Please try again.');
      throw err;
    }
  };

  const handleDeleteCourse = async (course: DegreeCourse) => {
    if (!user) return;
    try {
      await deleteDegreeCourse(user.uid, course.id);
      showSuccess('Course removed');
    } catch (err) {
      showError("Couldn't remove that course", 'Please try again.');
      throw err;
    }
  };

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading Degree Compass…</div>;
  }

  if (!profile) {
    return <DegreeSetupForm onSubmit={handleSetupSubmit} />;
  }

  const overall = computeOverallProgress(profile.categories, courses);
  const earned = overall.creditsCompleted + overall.creditsInProgress;
  const overallPct = overall.creditsRequired
    ? Math.min(100, Math.round((earned / overall.creditsRequired) * 100))
    : 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-foreground">
            <span className="font-semibold">{profile.majorName}</span>
            {profile.minorName && (
              <span className="text-muted-foreground"> · minor in {profile.minorName}</span>
            )}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {earned} / {overall.creditsRequired} credits ({overallPct}%)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-full border border-border p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('path')}
              className={cn(
                'rounded-full px-3 py-1.5 text-xs font-semibold transition-colors',
                viewMode === 'path'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
              aria-pressed={viewMode === 'path'}
            >
              Path
            </button>
            <button
              type="button"
              onClick={() => setViewMode('ledger')}
              className={cn(
                'rounded-full px-3 py-1.5 text-xs font-semibold transition-colors',
                viewMode === 'ledger'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
              aria-pressed={viewMode === 'ledger'}
            >
              Ledger
            </button>
          </div>
          <CardActionButton variant="solid" withPlus onClick={openAddCourse}>
            Add course
          </CardActionButton>
        </div>
      </div>

      {viewMode === 'path' ? (
        <PathView
          categories={profile.categories}
          courses={courses}
          onEditCourse={openEditCourse}
          onDeleteCourse={handleDeleteCourse}
        />
      ) : (
        <LedgerView
          categories={profile.categories}
          courses={courses}
          onEditCourse={openEditCourse}
          onDeleteCourse={handleDeleteCourse}
        />
      )}

      <DegreeCourseFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleCourseSubmit}
        categories={profile.categories}
        initialCourse={editingCourse}
      />
    </div>
  );
}
