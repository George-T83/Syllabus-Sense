import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GpaGoalRadial } from '../GpaGoalRadial';

describe('GpaGoalRadial (Item 47)', () => {
  it('renders radial progress gauge with term GPA and status badge', () => {
    render(<GpaGoalRadial />);

    expect(screen.getByText('Semester GPA Goal & Quality Points Tracker')).toBeDefined();
    expect(screen.getByTestId('gpa-status-badge')).toBeDefined();
    expect(screen.getAllByRole('progressbar')).toHaveLength(2);
    expect(screen.getAllByText(/Term GPA/i).length).toBeGreaterThanOrEqual(1);
  });

  it('updates target GPA dynamically when input changes', () => {
    render(<GpaGoalRadial initialTargetGpa={3.5} />);

    const targetInput = screen.getByLabelText(/Target cumulative GPA/i);
    fireEvent.change(targetInput, { target: { value: '3.8' } });

    expect(screen.getByText(/Goal Slider: 3.80/i)).toBeDefined();
  });

  it('updates simulated course grades and recalculates quality points', () => {
    render(<GpaGoalRadial />);

    const gradeSelect = screen.getByLabelText(/CS 301 grade/i);
    fireEvent.change(gradeSelect, { target: { value: 'B' } });

    // 4 credits * 3.0 = 12.0 QP
    expect(screen.getAllByText('12.0').length).toBeGreaterThanOrEqual(1);
  });

  it('updates course credit hours and recalculates total term credits', () => {
    render(<GpaGoalRadial />);

    const creditInput = screen.getByLabelText(/CS 301 credits/i);
    fireEvent.change(creditInput, { target: { value: '5' } });

    expect(screen.getAllByText(/16 Credits/i).length).toBeGreaterThanOrEqual(1);
  });

  it('colors the cumulative ring semantically by goal status', () => {
    // A low target with a strong prior GPA reads as comfortably ahead - the
    // cumulative ring's arc should be the calm "low" (safe) color, not an
    // arbitrary brand tint.
    render(<GpaGoalRadial initialPriorGpa={3.9} initialPriorCredits={90} initialTargetGpa={3.0} />);

    expect(screen.getByText(/Ahead of Goal/i)).toBeDefined();
    // Second progressbar (cumulative) is the second RingGauge in the DOM;
    // its progress arc is the second <circle> within it.
    const cumulativeRing = screen.getAllByRole('progressbar')[1];
    const arc = cumulativeRing.querySelectorAll('circle')[1];
    expect(arc.getAttribute('class')).toMatch(/stroke-load-low/);
  });

  it('renders two independently-labeled rings for term and cumulative GPA', () => {
    render(<GpaGoalRadial />);

    const rings = screen.getAllByRole('progressbar');
    expect(rings[0].getAttribute('aria-label')).toMatch(/Current term GPA/i);
    expect(rings[1].getAttribute('aria-label')).toMatch(/Projected cumulative GPA/i);
  });
});
