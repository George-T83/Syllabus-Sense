import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NextClassHeroBanner, formatTime12h, extractMeetingLink } from '../NextClassHeroBanner';
import type { Course } from '@/types/schedule';

const MOCK_COURSES: Course[] = [
  {
    id: 'c1',
    code: 'CS 301',
    title: 'Data Structures & Algorithms',
    instructor: 'Dr. Turing',
    color: '#3B82F6',
    modality: 'in-person',
    meetingTimes: [
      {
        dayOfWeek: 1, // Monday
        startTime: '10:00',
        endTime: '11:15',
        location: 'Turing Hall 101',
      },
      {
        dayOfWeek: 3, // Wednesday
        startTime: '10:00',
        endTime: '11:15',
        location: 'Turing Hall 101',
      },
    ],
  },
  {
    id: 'c2',
    code: 'MATH 240',
    title: 'Linear Algebra',
    instructor: 'Prof. Gauss',
    color: '#10B981',
    modality: 'online',
    notes: 'Online lectures via https://zoom.us/j/9876543210',
    meetingTimes: [
      {
        dayOfWeek: 1, // Monday
        startTime: '14:00',
        endTime: '15:30',
        location: 'Zoom',
      },
    ],
  },
];

describe('NextClassHeroBanner (Item 44)', () => {
  it('formats 24h military time into friendly 12h AM/PM strings', () => {
    expect(formatTime12h('09:00')).toBe('9:00 AM');
    expect(formatTime12h('12:00')).toBe('12:00 PM');
    expect(formatTime12h('14:30')).toBe('2:30 PM');
    expect(formatTime12h('23:45')).toBe('11:45 PM');
  });

  it('extracts Zoom / meeting links from course notes or location', () => {
    const link = extractMeetingLink(MOCK_COURSES[1], MOCK_COURSES[1].meetingTimes![0]);
    expect(link).toBe('https://zoom.us/j/9876543210');
  });

  it('detects an ongoing class in session and renders Live Now pill', () => {
    // Set current time to Monday at 10:30 AM (during CS 301 10:00-11:15)
    // 2026-08-24 is a Monday!
    const mockMondayNow = new Date('2026-08-24T10:30:00');

    render(<NextClassHeroBanner courses={MOCK_COURSES} currentTime={mockMondayNow} />);

    expect(screen.getByTestId('next-class-hero-banner')).toBeDefined();
    expect(screen.getByTestId('live-status-pill')).toBeDefined();
    expect(screen.getByText(/Live Now • 45m left/i)).toBeDefined();
    expect(screen.getByText('Data Structures & Algorithms')).toBeDefined();
    expect(screen.getAllByText('Turing Hall 101').length).toBeGreaterThanOrEqual(1);
  });

  it('detects upcoming class earlier in the same day and displays countdown', () => {
    // Set time to Monday at 9:36 AM (24 mins before CS 301 at 10:00)
    const mockMondayNow = new Date('2026-08-24T09:36:00');

    render(<NextClassHeroBanner courses={MOCK_COURSES} currentTime={mockMondayNow} />);

    expect(screen.getByTestId('upcoming-status-pill')).toBeDefined();
    expect(screen.getByText(/Starts in 24 min/i)).toBeDefined();
    expect(screen.getByText('CS 301')).toBeDefined();
  });

  it('detects next upcoming online class and provides direct Join Class link', () => {
    // Monday at 12:00 PM (before Math 240 at 14:00)
    const mockMondayNow = new Date('2026-08-24T12:00:00');
    const onJoin = vi.fn();

    render(
      <NextClassHeroBanner
        courses={MOCK_COURSES}
        currentTime={mockMondayNow}
        onJoinMeeting={onJoin}
      />,
    );

    expect(screen.getByText('Linear Algebra')).toBeDefined();
    const joinBtn = screen.getByTestId('join-class-btn');
    expect(joinBtn.getAttribute('href')).toBe('https://zoom.us/j/9876543210');

    fireEvent.click(joinBtn);
    expect(onJoin).toHaveBeenCalled();
  });

  it('shows next session later in week when today has no remaining classes', () => {
    // Tuesday 2026-08-25 at 10:00 AM (next class is Wednesday CS 301)
    const mockTuesdayNow = new Date('2026-08-25T10:00:00');

    render(<NextClassHeroBanner courses={MOCK_COURSES} currentTime={mockTuesdayNow} />);

    expect(screen.getByTestId('future-status-pill')).toBeDefined();
    expect(screen.getByText(/Tomorrow • 10:00 AM/i)).toBeDefined();
    expect(screen.getByText('CS 301')).toBeDefined();
  });

  it('renders completed card when no courses have meeting times', () => {
    render(<NextClassHeroBanner courses={[]} />);

    expect(screen.getByTestId('no-upcoming-classes-card')).toBeDefined();
    expect(screen.getByText(/All classes completed!/i)).toBeDefined();
  });

  it('skips a class explicitly cancelled today via skipDates and surfaces the next one instead', () => {
    // Monday 2026-08-24, 9:36 AM - CS 301 (10:00) is cancelled today, so the
    // next real session should be Linear Algebra (14:00) instead.
    const mockMondayNow = new Date('2026-08-24T09:36:00');
    const coursesWithCancelledClass: Course[] = [
      { ...MOCK_COURSES[0], skipDates: ['2026-08-24'] },
      MOCK_COURSES[1],
    ];

    render(<NextClassHeroBanner courses={coursesWithCancelledClass} currentTime={mockMondayNow} />);

    expect(screen.queryByText('Data Structures & Algorithms')).toBeNull();
    expect(screen.getByText('Linear Algebra')).toBeDefined();
  });
});
