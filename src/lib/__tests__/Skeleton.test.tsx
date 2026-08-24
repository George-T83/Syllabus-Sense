import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  Skeleton,
  SkeletonText,
  SkeletonCard,
  SkeletonButton,
} from '@/components/ui/Skeleton';
import DashboardLoading from '@/app/(app)/dashboard/loading';
import CoursesLoading from '@/app/(app)/courses/loading';
import TasksLoading from '@/app/(app)/tasks/loading';
import CalendarLoading from '@/app/(app)/calendar/loading';
import ContactsLoading from '@/app/(app)/contacts/loading';
import AppRootLoading from '@/app/(app)/loading';

describe('Skeleton Components & Route Loading Skeletons (Item 28)', () => {
  describe('Skeleton Base Component', () => {
    it('renders accessible status role and aria-busy attributes', () => {
      render(<Skeleton data-testid="skeleton-test" />);
      const skeleton = screen.getByTestId('skeleton-test');

      expect(skeleton).toBeDefined();
      expect(skeleton.getAttribute('role')).toBe('status');
      expect(skeleton.getAttribute('aria-busy')).toBe('true');
      expect(skeleton.classList.contains('animate-pulse')).toBe(true);
      expect(skeleton.classList.contains('rounded-xl')).toBe(true);
    });

    it('renders circular variant with full rounded styles', () => {
      render(
        <Skeleton variant="circular" width={48} height={48} data-testid="circle-skel" />
      );
      const circle = screen.getByTestId('circle-skel');
      expect(circle.classList.contains('rounded-full')).toBe(true);
      expect(circle.style.width).toBe('48px');
      expect(circle.style.height).toBe('48px');
    });

    it('renders text variant with default line styles', () => {
      render(
        <Skeleton variant="text" data-testid="text-skel" />
      );
      const text = screen.getByTestId('text-skel');
      expect(text.classList.contains('rounded-md')).toBe(true);
    });
  });

  describe('Composite Skeleton Helpers', () => {
    it('renders SkeletonText with specified line count', () => {
      const { container } = render(<SkeletonText lines={4} />);
      const elements = container.querySelectorAll('[role="status"] > [role="status"]');
      expect(elements.length).toBe(4);
    });

    it('renders SkeletonCard with card styling and layout', () => {
      const { container } = render(<SkeletonCard />);
      const card = container.querySelector('.rounded-2xl');
      expect(card).toBeDefined();
      expect(card?.getAttribute('aria-busy')).toBe('true');
    });

    it('renders SkeletonButton with minimum touch height', () => {
      const { container } = render(<SkeletonButton width={140} height={44} />);
      const button = container.firstChild as HTMLElement;
      expect(button.classList.contains('min-h-[44px]')).toBe(true);
      expect(button.style.width).toBe('140px');
    });
  });

  describe('Route Loading Skeletons', () => {
    it('renders DashboardLoading without error and includes dashboard skeleton testid', () => {
      render(<DashboardLoading />);
      expect(screen.getByTestId('dashboard-loading-skeleton')).toBeDefined();
    });

    it('renders CoursesLoading without error and includes courses skeleton testid', () => {
      render(<CoursesLoading />);
      expect(screen.getByTestId('courses-loading-skeleton')).toBeDefined();
    });

    it('renders TasksLoading without error and includes tasks skeleton testid', () => {
      render(<TasksLoading />);
      expect(screen.getByTestId('tasks-loading-skeleton')).toBeDefined();
    });

    it('renders CalendarLoading without error and includes calendar skeleton testid', () => {
      render(<CalendarLoading />);
      expect(screen.getByTestId('calendar-loading-skeleton')).toBeDefined();
    });

    it('renders ContactsLoading without error and includes contacts skeleton testid', () => {
      render(<ContactsLoading />);
      expect(screen.getByTestId('contacts-loading-skeleton')).toBeDefined();
    });

    it('renders AppRootLoading without error and includes root skeleton testid', () => {
      render(<AppRootLoading />);
      expect(screen.getByTestId('app-root-loading-skeleton')).toBeDefined();
    });
  });
});
