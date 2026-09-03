'use client';

import React, { useState, useMemo } from 'react';
import { Card } from '@/components/ui/Card';
import { CardActionButton } from '@/components/ui/CardAction';
import { EmptyState } from '@/components/ui/EmptyState';

export type ActivityCategory = 'club' | 'research' | 'internship' | 'athletics' | 'volunteering';

export interface Milestone {
  id: string;
  title: string;
  dueDate: string;
  completed: boolean;
  notes?: string;
}

export interface ExtracurricularActivity {
  id: string;
  title: string;
  category: ActivityCategory;
  organization: string;
  role: string;
  hoursPerWeek: number;
  status: 'active' | 'paused' | 'completed';
  startDate: string;
  endDate?: string;
  milestones: Milestone[];
  notes?: string;
}

const CATEGORY_CONFIG: Record<
  ActivityCategory,
  { label: string; color: string; bg: string; border: string; iconPath: string }
> = {
  club: {
    label: 'Club / Organization',
    color: 'text-indigo-400',
    bg: 'bg-indigo-500/10',
    border: 'border-indigo-500/30',
    iconPath:
      'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
  },
  research: {
    label: 'Lab Research',
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/10',
    border: 'border-cyan-500/30',
    iconPath:
      'M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z',
  },
  internship: {
    label: 'Internship / Job Apps',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    iconPath:
      'M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
  },
  athletics: {
    label: 'Athletics & Fitness',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
    iconPath:
      'M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z',
  },
  volunteering: {
    label: 'Community Service',
    color: 'text-rose-400',
    bg: 'bg-rose-500/10',
    border: 'border-rose-500/30',
    iconPath:
      'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z',
  },
};

const DEFAULT_ACTIVITIES: ExtracurricularActivity[] = [
  {
    id: 'act-1',
    title: 'ACM Student Chapter',
    category: 'club',
    organization: 'Association for Computing Machinery',
    role: 'Vice President',
    hoursPerWeek: 5,
    status: 'active',
    startDate: '2026-01-15',
    milestones: [
      {
        id: 'm-1',
        title: 'Spring Hackathon Planning & Sponsor Outreach',
        dueDate: '2026-09-15',
        completed: true,
      },
      { id: 'm-2', title: 'Host Intro to Rust Workshop', dueDate: '2026-10-08', completed: false },
      {
        id: 'm-3',
        title: 'Finalize Semester Budget with Student Affairs',
        dueDate: '2026-11-20',
        completed: false,
      },
    ],
    notes: 'Weekly executive board meetings on Tuesdays at 6:00 PM.',
  },
  {
    id: 'act-2',
    title: 'Robotics & Autonomous Systems Lab',
    category: 'research',
    organization: 'Dept. of Computer Science & Robotics',
    role: 'Undergraduate Research Assistant',
    hoursPerWeek: 8,
    status: 'active',
    startDate: '2026-02-01',
    milestones: [
      {
        id: 'm-4',
        title: 'Complete SLAM LiDAR calibration dataset',
        dueDate: '2026-09-22',
        completed: true,
      },
      {
        id: 'm-5',
        title: 'Submit IEEE ICRA Conference Abstract',
        dueDate: '2026-10-15',
        completed: false,
      },
      {
        id: 'm-6',
        title: 'Draft methodology section for semester paper',
        dueDate: '2026-11-30',
        completed: false,
      },
    ],
    notes: 'Lab meetings on Thursdays with Prof. Vance.',
  },
  {
    id: 'act-3',
    title: 'Summer 2027 SWE Applications',
    category: 'internship',
    organization: 'Tech & Fintech Recruiting',
    role: 'Software Engineering Applicant',
    hoursPerWeek: 4,
    status: 'active',
    startDate: '2026-08-01',
    milestones: [
      {
        id: 'm-7',
        title: 'Polish resume & update GitHub portfolio',
        dueDate: '2026-09-01',
        completed: true,
      },
      {
        id: 'm-8',
        title: 'Complete 30 LeetCode Medium problem sets',
        dueDate: '2026-09-30',
        completed: false,
      },
      {
        id: 'm-9',
        title: 'Submit 25 applications before priority deadlines',
        dueDate: '2026-10-20',
        completed: false,
      },
    ],
    notes: 'Aiming for distributed systems and backend infrastructure internships.',
  },
];

const MAX_RECOMMENDED_HOURS = 20;

export interface ExtracurricularViewProps {
  initialActivities?: ExtracurricularActivity[];
  maxWeeklyCapacity?: number;
  onActivitiesChange?: (activities: ExtracurricularActivity[]) => void;
}

export function ExtracurricularView({
  initialActivities = DEFAULT_ACTIVITIES,
  maxWeeklyCapacity = MAX_RECOMMENDED_HOURS,
  onActivitiesChange,
}: ExtracurricularViewProps) {
  const [activities, setActivities] = useState<ExtracurricularActivity[]>(initialActivities);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingActivity, setEditingActivity] = useState<ExtracurricularActivity | null>(null);

  // Form State
  const [formTitle, setFormTitle] = useState('');
  const [formCategory, setFormCategory] = useState<ActivityCategory>('club');
  const [formOrg, setFormOrg] = useState('');
  const [formRole, setFormRole] = useState('');
  const [formHours, setFormHours] = useState(4);
  const [formStatus, setFormStatus] = useState<'active' | 'paused' | 'completed'>('active');
  const [formNotes, setFormNotes] = useState('');

  // New Milestone input state inside activity card
  const [activeAddingMilestoneId, setActiveAddingMilestoneId] = useState<string | null>(null);
  const [newMilestoneTitle, setNewMilestoneTitle] = useState('');
  const [newMilestoneDate, setNewMilestoneDate] = useState('');

  const handleUpdateActivities = (newActs: ExtracurricularActivity[]) => {
    setActivities(newActs);
    onActivitiesChange?.(newActs);
  };

  const totalWeeklyHours = useMemo(() => {
    return activities
      .filter((a) => a.status === 'active')
      .reduce((sum, a) => sum + (Number(a.hoursPerWeek) || 0), 0);
  }, [activities]);

  const loadPercentage = Math.min(100, Math.round((totalWeeklyHours / maxWeeklyCapacity) * 100));
  const isOverCapacity = totalWeeklyHours > maxWeeklyCapacity;

  const filteredActivities = useMemo(() => {
    return activities.filter((act) => {
      if (selectedCategory !== 'all' && act.category !== selectedCategory) return false;
      if (statusFilter !== 'all' && act.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = act.title.toLowerCase().includes(q);
        const matchesOrg = act.organization.toLowerCase().includes(q);
        const matchesRole = act.role.toLowerCase().includes(q);
        const matchesMilestone = act.milestones.some((m) => m.title.toLowerCase().includes(q));
        if (!matchesTitle && !matchesOrg && !matchesRole && !matchesMilestone) return false;
      }
      return true;
    });
  }, [activities, selectedCategory, statusFilter, searchQuery]);

  const allMilestonesSorted = useMemo(() => {
    const list: Array<{ activity: ExtracurricularActivity; milestone: Milestone }> = [];
    activities.forEach((act) => {
      act.milestones.forEach((m) => {
        list.push({ activity: act, milestone: m });
      });
    });
    return list.sort((a, b) => a.milestone.dueDate.localeCompare(b.milestone.dueDate));
  }, [activities]);

  const toggleMilestone = (activityId: string, milestoneId: string) => {
    const updated = activities.map((act) => {
      if (act.id !== activityId) return act;
      return {
        ...act,
        milestones: act.milestones.map((m) => {
          if (m.id !== milestoneId) return m;
          return { ...m, completed: !m.completed };
        }),
      };
    });
    handleUpdateActivities(updated);
  };

  const addMilestone = (activityId: string) => {
    if (!newMilestoneTitle.trim()) return;
    const newM: Milestone = {
      id: `m-${Date.now()}`,
      title: newMilestoneTitle.trim(),
      dueDate: newMilestoneDate || new Date().toISOString().split('T')[0],
      completed: false,
    };
    const updated = activities.map((act) => {
      if (act.id !== activityId) return act;
      return {
        ...act,
        milestones: [...act.milestones, newM],
      };
    });
    handleUpdateActivities(updated);
    setNewMilestoneTitle('');
    setNewMilestoneDate('');
    setActiveAddingMilestoneId(null);
  };

  const deleteActivity = (activityId: string) => {
    const updated = activities.filter((a) => a.id !== activityId);
    handleUpdateActivities(updated);
  };

  const openCreateModal = () => {
    setEditingActivity(null);
    setFormTitle('');
    setFormCategory('club');
    setFormOrg('');
    setFormRole('');
    setFormHours(4);
    setFormStatus('active');
    setFormNotes('');
    setIsModalOpen(true);
  };

  const openEditModal = (act: ExtracurricularActivity) => {
    setEditingActivity(act);
    setFormTitle(act.title);
    setFormCategory(act.category);
    setFormOrg(act.organization);
    setFormRole(act.role);
    setFormHours(act.hoursPerWeek);
    setFormStatus(act.status);
    setFormNotes(act.notes || '');
    setIsModalOpen(true);
  };

  const handleSaveActivity = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) return;

    if (editingActivity) {
      const updated = activities.map((act) => {
        if (act.id !== editingActivity.id) return act;
        return {
          ...act,
          title: formTitle.trim(),
          category: formCategory,
          organization: formOrg.trim(),
          role: formRole.trim(),
          hoursPerWeek: Number(formHours) || 0,
          status: formStatus,
          notes: formNotes.trim(),
        };
      });
      handleUpdateActivities(updated);
    } else {
      const newAct: ExtracurricularActivity = {
        id: `act-${Date.now()}`,
        title: formTitle.trim(),
        category: formCategory,
        organization: formOrg.trim(),
        role: formRole.trim(),
        hoursPerWeek: Number(formHours) || 0,
        status: formStatus,
        startDate: new Date().toISOString().split('T')[0],
        milestones: [],
        notes: formNotes.trim(),
      };
      handleUpdateActivities([...activities, newAct]);
    }
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Header & Capacity Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/30">
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
                  d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
                />
              </svg>
            </span>
            Extracurricular & Internship Hub
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Balance leadership, lab research, and career milestones alongside your coursework.
          </p>
        </div>
        <CardActionButton
          variant="solid"
          withPlus
          onClick={openCreateModal}
          data-testid="add-activity-btn"
        >
          Add Activity
        </CardActionButton>
      </div>

      {/* Commitment Capacity Meter Card */}
      <Card data-testid="capacity-gauge-card" className="p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className={`p-3 rounded-xl ${isOverCapacity ? 'bg-load-critical/10 text-load-critical' : 'bg-primary/10 text-primary'}`}
            >
              <svg
                className="w-6 h-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                {isOverCapacity ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                  />
                )}
              </svg>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
                Weekly Commitment Capacity
              </div>
              <div className="text-xl sm:text-2xl font-bold text-foreground flex items-baseline gap-2">
                <span>{totalWeeklyHours} hrs / week</span>
                <span className="text-sm font-normal text-muted-foreground">
                  (Target max: {maxWeeklyCapacity} hrs)
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span
              className={`px-3 py-1 text-xs font-semibold rounded-full border ${
                isOverCapacity
                  ? 'bg-load-critical/10 text-load-critical border-load-critical/30'
                  : loadPercentage > 75
                    ? 'bg-load-medium/10 text-load-medium border-load-medium/30'
                    : 'bg-load-low/10 text-load-low border-load-low/30'
              }`}
            >
              {isOverCapacity
                ? 'Over Capacity'
                : loadPercentage > 75
                  ? 'Heavy Load'
                  : 'Balanced Load'}
            </span>
            <span className="text-sm font-medium text-muted-foreground">{loadPercentage}%</span>
          </div>
        </div>

        {/* Visual Progress Bar */}
        <div className="mt-4 w-full bg-muted rounded-full h-3 overflow-hidden">
          <div
            role="progressbar"
            aria-valuenow={totalWeeklyHours}
            aria-valuemin={0}
            aria-valuemax={maxWeeklyCapacity}
            aria-label="Weekly extracurricular commitment gauge"
            className={`h-full transition-all duration-500 rounded-full ${
              isOverCapacity
                ? 'bg-load-critical shadow-load-critical/50'
                : loadPercentage > 75
                  ? 'bg-load-medium shadow-load-medium/50'
                  : 'bg-gradient-brand'
            }`}
            style={{ width: `${Math.min(100, loadPercentage)}%` }}
          />
        </div>
      </Card>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground">
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
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search activities or milestones..."
            aria-label="Search activities or milestones"
            className="w-full pl-10 pr-4 py-2.5 bg-card/60 border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary min-h-[44px]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Category Dropdown */}
          <div className="flex items-center gap-1.5 bg-card/60 border border-border rounded-xl px-3 py-1.5 min-h-[44px]">
            <svg
              className="w-3.5 h-3.5 text-muted-foreground"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
              />
            </svg>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              aria-label="Filter by activity category"
              className="bg-transparent text-xs text-foreground focus:outline-none cursor-pointer"
            >
              <option value="all" className="bg-card">
                All Categories
              </option>
              <option value="club" className="bg-card">
                Clubs & Orgs
              </option>
              <option value="research" className="bg-card">
                Lab Research
              </option>
              <option value="internship" className="bg-card">
                Internships / Jobs
              </option>
              <option value="athletics" className="bg-card">
                Athletics
              </option>
              <option value="volunteering" className="bg-card">
                Volunteering
              </option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5 bg-card/60 border border-border rounded-xl px-3 py-1.5 min-h-[44px]">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filter by activity status"
              className="bg-transparent text-xs text-foreground focus:outline-none cursor-pointer"
            >
              <option value="all" className="bg-card">
                All Statuses
              </option>
              <option value="active" className="bg-card">
                Active Only
              </option>
              <option value="paused" className="bg-card">
                Paused
              </option>
              <option value="completed" className="bg-card">
                Completed
              </option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Grid: Activity Cards & Milestones Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 spans): Activity Cards */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-lg font-semibold text-foreground flex items-center justify-between">
            <span>Enrolled Activities ({filteredActivities.length})</span>
          </h2>

          {filteredActivities.length === 0 ? (
            <EmptyState
              icon={
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
              }
              title="No activities match your filters"
              action={{
                label: 'Clear all filters',
                onClick: () => {
                  setSelectedCategory('all');
                  setStatusFilter('all');
                  setSearchQuery('');
                },
              }}
            />
          ) : (
            filteredActivities.map((act) => {
              const cfg = CATEGORY_CONFIG[act.category];
              const completedMilestonesCount = act.milestones.filter((m) => m.completed).length;
              const totalMilestonesCount = act.milestones.length;
              const isAddingM = activeAddingMilestoneId === act.id;

              return (
                <Card
                  key={act.id}
                  hoverable
                  data-testid={`activity-card-${act.id}`}
                  className="p-5 space-y-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div
                        className={`p-2.5 rounded-xl ${cfg.bg} ${cfg.color} border ${cfg.border}`}
                      >
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d={cfg.iconPath} />
                        </svg>
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-base font-bold text-foreground">{act.title}</h3>
                          <span
                            className={`px-2 py-0.5 text-[10px] font-semibold rounded-full uppercase tracking-wider border ${cfg.bg} ${cfg.color} ${cfg.border}`}
                          >
                            {cfg.label}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {act.role} •{' '}
                          <span className="text-foreground/80">{act.organization}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditModal(act)}
                        aria-label={`Edit ${act.title}`}
                        className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
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
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                          />
                        </svg>
                      </button>
                      <button
                        onClick={() => deleteActivity(act.id)}
                        aria-label={`Delete ${act.title}`}
                        className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
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
                    </div>
                  </div>

                  {/* Hours & Milestones progress line */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 py-2 border-y border-border/60 text-xs">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <svg
                        className="w-3.5 h-3.5 text-primary"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <span>{act.hoursPerWeek} hrs / week</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <svg
                        className="w-3.5 h-3.5 text-load-low"
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
                      <span>
                        {completedMilestonesCount}/{totalMilestonesCount} milestones
                      </span>
                    </div>
                    <div className="col-span-2 sm:col-span-1 flex items-center gap-1.5 text-muted-foreground">
                      <span
                        className={`w-2 h-2 rounded-full ${act.status === 'active' ? 'bg-load-low' : act.status === 'paused' ? 'bg-load-medium' : 'bg-muted-foreground'}`}
                      />
                      <span className="capitalize">{act.status}</span>
                    </div>
                  </div>

                  {/* Milestones list for this activity */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
                      <span>Milestones & Goals</span>
                      <button
                        onClick={() => setActiveAddingMilestoneId(isAddingM ? null : act.id)}
                        className="text-primary hover:opacity-80 flex items-center gap-1 cursor-pointer min-h-[32px] px-2"
                      >
                        <svg
                          className="w-3 h-3"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                        </svg>
                        {isAddingM ? 'Cancel' : 'Add Milestone'}
                      </button>
                    </div>

                    {/* Inline Add Milestone Form */}
                    {isAddingM && (
                      <div className="p-3 rounded-xl bg-muted/40 border border-primary/30 space-y-2">
                        <input
                          type="text"
                          value={newMilestoneTitle}
                          onChange={(e) => setNewMilestoneTitle(e.target.value)}
                          placeholder="Milestone title (e.g. Submit paper draft)..."
                          aria-label="New milestone title"
                          className="w-full px-3 py-1.5 bg-background border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                        <div className="flex items-center gap-2">
                          <input
                            type="date"
                            value={newMilestoneDate}
                            onChange={(e) => setNewMilestoneDate(e.target.value)}
                            aria-label="New milestone due date"
                            className="px-2.5 py-1.5 bg-background border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                          <button
                            onClick={() => addMilestone(act.id)}
                            className="px-3 py-1.5 bg-primary hover:opacity-90 text-primary-foreground rounded-lg text-xs font-medium transition-colors cursor-pointer"
                          >
                            Save Milestone
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="space-y-1.5">
                      {act.milestones.map((m) => (
                        <div
                          key={m.id}
                          className="flex items-center justify-between gap-2 p-2 rounded-xl bg-muted/30 border border-border/60 hover:border-border transition-colors"
                        >
                          <button
                            onClick={() => toggleMilestone(act.id, m.id)}
                            aria-label={`Toggle milestone ${m.title}`}
                            className="flex items-center gap-2.5 text-left flex-1 cursor-pointer min-h-[44px]"
                          >
                            {m.completed ? (
                              <svg
                                className="w-4 h-4 text-load-low shrink-0"
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
                            ) : (
                              <svg
                                className="w-4 h-4 text-muted-foreground shrink-0"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={2}
                              >
                                <circle cx="12" cy="12" r="9" />
                              </svg>
                            )}
                            <span
                              className={`text-xs font-medium ${m.completed ? 'line-through text-muted-foreground' : 'text-foreground'}`}
                            >
                              {m.title}
                            </span>
                          </button>
                          <span className="text-[11px] text-muted-foreground shrink-0 font-mono">
                            {m.dueDate}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </Card>
              );
            })
          )}
        </div>

        {/* Right Column (1 span): Unified Chronological Milestone Timeline */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <svg
              className="w-5 h-5 text-primary"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            Upcoming Milestones
          </h2>

          <Card className="p-5 space-y-3">
            {allMilestonesSorted.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">
                No upcoming milestones.
              </p>
            ) : (
              <div className="space-y-3 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-[2px] before:bg-border">
                {allMilestonesSorted.map(({ activity, milestone }) => {
                  const cfg = CATEGORY_CONFIG[activity.category];
                  return (
                    <div
                      key={`${activity.id}-${milestone.id}`}
                      className="flex items-start gap-3 pl-6 relative group"
                    >
                      <button
                        onClick={() => toggleMilestone(activity.id, milestone.id)}
                        aria-label={`Mark milestone ${milestone.title} as ${milestone.completed ? 'incomplete' : 'complete'}`}
                        className={`absolute left-1.5 top-0.5 w-3.5 h-3.5 rounded-full border-2 transition-all cursor-pointer ${
                          milestone.completed
                            ? 'bg-load-low border-load-low'
                            : 'bg-card border-border group-hover:border-primary'
                        }`}
                      />
                      <div className="flex-1">
                        <div
                          className={`text-xs font-semibold ${milestone.completed ? 'line-through text-muted-foreground' : 'text-foreground'}`}
                        >
                          {milestone.title}
                        </div>
                        <div className="text-[11px] text-muted-foreground flex items-center justify-between gap-1 mt-0.5">
                          <span className={`${cfg.color}`}>{activity.title}</span>
                          <span className="font-mono text-muted-foreground">
                            {milestone.dueDate}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Add / Edit Activity Modal */}
      {isModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="activity-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
        >
          <Card
            accent="none"
            className="relative w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 id="activity-modal-title" className="text-lg font-bold text-foreground">
                {editingActivity ? 'Edit Activity' : 'Add Extracurricular Activity'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                aria-label="Close modal"
                className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
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

            <form onSubmit={handleSaveActivity} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Activity Title *
                </label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g. ACM Student Chapter, Robotics Research"
                  className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    Category *
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as ActivityCategory)}
                    className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="club">Club / Organization</option>
                    <option value="research">Lab Research</option>
                    <option value="internship">Internship / Job Apps</option>
                    <option value="athletics">Athletics / Fitness</option>
                    <option value="volunteering">Community Service</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    Weekly Hours *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="40"
                    required
                    value={formHours}
                    onChange={(e) => setFormHours(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    Organization / Department
                  </label>
                  <input
                    type="text"
                    value={formOrg}
                    onChange={(e) => setFormOrg(e.target.value)}
                    placeholder="e.g. IEEE, CS Dept, Google"
                    className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    Role / Position
                  </label>
                  <input
                    type="text"
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value)}
                    placeholder="e.g. Lead Researcher, Member"
                    className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Status
                </label>
                <select
                  value={formStatus}
                  onChange={(e) =>
                    setFormStatus(e.target.value as 'active' | 'paused' | 'completed')
                  }
                  className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                  <option value="completed">Completed</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Notes & Details
                </label>
                <textarea
                  rows={2}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Meeting times, links, or goals..."
                  className="w-full px-3.5 py-2 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted text-sm font-medium transition-colors cursor-pointer min-h-[44px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-primary hover:opacity-90 text-primary-foreground text-sm font-medium transition-colors shadow-lg shadow-primary/20 cursor-pointer min-h-[44px]"
                >
                  {editingActivity ? 'Save Changes' : 'Create Activity'}
                </button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
