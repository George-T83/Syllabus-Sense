'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import type { Course, MeetingTime } from '@/types/schedule';

export interface NextClassHeroBannerProps {
  courses: Course[];
  /** Optional custom date/time for deterministic testing or override */
  currentTime?: Date;
  onJoinMeeting?: (course: Course, link: string) => void;
}

export interface ClassSessionEvent {
  course: Course;
  meeting: MeetingTime;
  startTimeDate: Date;
  endTimeDate: Date;
  isHappeningNow: boolean;
  minutesUntilStart: number;
  minutesRemaining: number;
  meetingLink?: string;
  isToday: boolean;
  dayLabel: string;
}

/** Extract URL from text if present (e.g. Zoom, Google Meet, Teams, or generic http) */
export function extractMeetingLink(course: Course, meeting: MeetingTime): string | undefined {
  const sources = [meeting.location, course.notes, course.instructor];
  for (const src of sources) {
    if (!src) continue;
    const match = src.match(/https?:\/\/[^\s"'<>]+/i);
    if (match) return match[0];
  }
  if (course.modality === 'online' || course.modality === 'hybrid') {
    return 'https://zoom.us/join';
  }
  return undefined;
}

/** Formats 24h "HH:mm" string into friendly 12h format "9:00 AM" */
export function formatTime12h(time24: string): string {
  const [hStr, mStr] = time24.split(':');
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10) || 0;
  if (isNaN(h)) return time24;
  const period = h >= 12 ? 'PM' : 'AM';
  const displayH = h % 12 === 0 ? 12 : h % 12;
  const displayM = m < 10 ? `0${m}` : `${m}`;
  return `${displayH}:${displayM} ${period}`;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function findNextClassSession(
  courses: Course[],
  now: Date = new Date()
): ClassSessionEvent | null {
  const currentDayOfWeek = now.getDay();
  const currentHours = now.getHours();
  const currentMinutes = now.getMinutes();
  const currentTotalMinutes = currentHours * 60 + currentMinutes;

  const todaySessions: ClassSessionEvent[] = [];
  const futureSessions: ClassSessionEvent[] = [];

  courses.forEach((course) => {
    if (!course.meetingTimes || course.meetingTimes.length === 0) return;

    course.meetingTimes.forEach((meeting) => {
      const [startH, startM] = meeting.startTime.split(':').map(Number);
      const [endH, endM] = meeting.endTime.split(':').map(Number);
      const startTotal = (startH || 0) * 60 + (startM || 0);
      const endTotal = (endH || 0) * 60 + (endM || 0);

      const link = extractMeetingLink(course, meeting);

      if (meeting.dayOfWeek === currentDayOfWeek) {
        const isHappeningNow = currentTotalMinutes >= startTotal && currentTotalMinutes <= endTotal;
        const minutesUntilStart = startTotal - currentTotalMinutes;
        const minutesRemaining = endTotal - currentTotalMinutes;

        const startDate = new Date(now);
        startDate.setHours(startH || 0, startM || 0, 0, 0);

        const endDate = new Date(now);
        endDate.setHours(endH || 0, endM || 0, 0, 0);

        if (isHappeningNow || minutesUntilStart > 0) {
          todaySessions.push({
            course,
            meeting,
            startTimeDate: startDate,
            endTimeDate: endDate,
            isHappeningNow,
            minutesUntilStart,
            minutesRemaining,
            meetingLink: link,
            isToday: true,
            dayLabel: 'Today',
          });
        }
      } else {
        // Calculate days offset into future
        let dayDiff = meeting.dayOfWeek - currentDayOfWeek;
        if (dayDiff <= 0) dayDiff += 7;

        const futureDate = new Date(now);
        futureDate.setDate(now.getDate() + dayDiff);
        futureDate.setHours(startH || 0, startM || 0, 0, 0);

        const futureEndDate = new Date(futureDate);
        futureEndDate.setHours(endH || 0, endM || 0, 0, 0);

        const minutesUntil = dayDiff * 24 * 60 + (startTotal - currentTotalMinutes);

        futureSessions.push({
          course,
          meeting,
          startTimeDate: futureDate,
          endTimeDate: futureEndDate,
          isHappeningNow: false,
          minutesUntilStart: minutesUntil,
          minutesRemaining: (endTotal - startTotal),
          meetingLink: link,
          isToday: false,
          dayLabel: dayDiff === 1 ? 'Tomorrow' : DAY_NAMES[meeting.dayOfWeek],
        });
      }
    });
  });

  // Prioritize happening now, then closest upcoming today
  if (todaySessions.length > 0) {
    todaySessions.sort((a, b) => {
      if (a.isHappeningNow && !b.isHappeningNow) return -1;
      if (!a.isHappeningNow && b.isHappeningNow) return 1;
      return a.minutesUntilStart - b.minutesUntilStart;
    });
    return todaySessions[0];
  }

  // Next closest upcoming in the week
  if (futureSessions.length > 0) {
    futureSessions.sort((a, b) => a.minutesUntilStart - b.minutesUntilStart);
    return futureSessions[0];
  }

  return null;
}

export function NextClassHeroBanner({
  courses,
  currentTime,
  onJoinMeeting,
}: NextClassHeroBannerProps) {
  const [copied, setCopied] = useState(false);
  const now = currentTime || new Date();

  const nextSession = useMemo(() => {
    return findNextClassSession(courses, now);
  }, [courses, now]);

  const handleCopyLocation = (text: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!nextSession) {
    return (
      <div
        data-testid="no-upcoming-classes-card"
        className="relative overflow-hidden rounded-2xl bg-slate-900/60 border border-slate-800 p-5 sm:p-6 backdrop-blur-xl shadow-lg"
      >
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h3 className="text-base font-bold text-white">All classes completed!</h3>
            <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
              No more scheduled lectures or labs for the rest of today. Focus on your smart study plan!
            </p>
          </div>
        </div>
      </div>
    );
  }

  const {
    course,
    meeting,
    isHappeningNow,
    minutesUntilStart,
    minutesRemaining,
    meetingLink,
    isToday,
    dayLabel,
  } = nextSession;

  const locationText = meeting.location || (course.modality === 'online' ? 'Online / Zoom' : 'Main Campus');
  const formattedStart = formatTime12h(meeting.startTime);
  const formattedEnd = formatTime12h(meeting.endTime);

  return (
    <div
      data-testid="next-class-hero-banner"
      className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-950/80 via-slate-900/90 to-slate-950 border border-indigo-500/30 p-5 sm:p-7 shadow-2xl backdrop-blur-2xl transition-all"
    >
      {/* Background ambient glow effect */}
      <div
        className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-indigo-500/15 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -left-16 -bottom-16 h-64 w-64 rounded-full bg-cyan-500/10 blur-3xl"
        aria-hidden="true"
      />

      <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
        {/* Left Side: Next Class Details */}
        <div className="space-y-3 flex-1 min-w-0">
          {/* Status & Countdown Pill */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {isHappeningNow ? (
              <span
                data-testid="live-status-pill"
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse"
              >
                <span className="w-2 h-2 rounded-full bg-rose-400 animate-ping" />
                Live Now • {minutesRemaining}m left
              </span>
            ) : isToday ? (
              <span
                data-testid="upcoming-status-pill"
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold tracking-wide bg-indigo-500/20 text-indigo-300 border border-indigo-500/40"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {minutesUntilStart <= 60
                  ? `Starts in ${minutesUntilStart} min`
                  : `Next Today • ${formattedStart}`}
              </span>
            ) : (
              <span
                data-testid="future-status-pill"
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold tracking-wide bg-slate-800 text-slate-300 border border-slate-700"
              >
                {dayLabel} • {formattedStart}
              </span>
            )}

            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-800/80 text-slate-300 border border-slate-700/60 capitalize">
              {course.modality || 'In-Person'}
            </span>
          </div>

          {/* Course Title & Code */}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: course.color || '#6366f1' }}
              />
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-300">
                {course.code}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-white tracking-tight truncate mt-0.5">
              {course.title}
            </h2>
          </div>

          {/* Instructor & Location Meta */}
          <div className="flex flex-wrap items-center gap-4 text-xs sm:text-sm text-slate-300 pt-1">
            {course.instructor && (
              <div className="flex items-center gap-1.5">
                <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span>{course.instructor}</span>
              </div>
            )}

            <div className="flex items-center gap-1.5">
              <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="font-medium text-slate-200">{locationText}</span>
              <button
                type="button"
                onClick={() => handleCopyLocation(locationText)}
                aria-label="Copy room and location"
                className="text-slate-400 hover:text-white p-1 rounded transition-colors cursor-pointer"
              >
                {copied ? (
                  <span className="text-[10px] text-emerald-400 font-semibold">Copied!</span>
                ) : (
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                )}
              </button>
            </div>

            <div className="flex items-center gap-1.5 font-mono text-xs text-indigo-300">
              <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{formattedStart} – {formattedEnd}</span>
            </div>
          </div>
        </div>

        {/* Right Side: Quick Actions (Join Class / View Syllabus) */}
        <div className="flex flex-row lg:flex-col sm:items-stretch gap-3 shrink-0">
          {meetingLink ? (
            <a
              href={meetingLink}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => onJoinMeeting?.(course, meetingLink)}
              data-testid="join-class-btn"
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-semibold text-sm shadow-xl shadow-indigo-600/30 active:scale-95 transition-all min-h-[44px] cursor-pointer"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <span>Join Class</span>
            </a>
          ) : (
            <button
              type="button"
              onClick={() => handleCopyLocation(locationText)}
              data-testid="directions-class-btn"
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 border border-indigo-500/40 font-semibold text-sm transition-all min-h-[44px] cursor-pointer"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span>{locationText}</span>
            </button>
          )}

          <Link
            href={`/courses/${course.id}`}
            data-testid="view-course-syllabus-link"
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-2xl bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/80 text-xs font-medium transition-colors min-h-[44px]"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span>Course Syllabus</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
