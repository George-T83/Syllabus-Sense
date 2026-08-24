import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LatePenaltyAdvisor } from '../LatePenaltyAdvisor';

describe('LatePenaltyAdvisor (Item 49)', () => {
  it('renders late penalty simulator with default parameters and decay chart', () => {
    render(
      <LatePenaltyAdvisor
        courseCode="CS 301"
        assignmentTitle="Project 2: Trees"
        defaultRawScore={95}
      />
    );

    expect(screen.getByText('Late Submission Penalty & Grace Advisor')).toBeDefined();
    expect(screen.getByTestId('penalty-status-badge')).toBeDefined();
    expect(screen.getByRole('img')).toBeDefined();
    expect(screen.getByTestId('final-recorded-score')).toBeDefined();
  });

  it('updates live score calculation when hours late slider moves', () => {
    render(<LatePenaltyAdvisor defaultRawScore={100} />);

    const slider = screen.getByLabelText(/Hours Late Slider/i);
    // Move to 48 hours
    fireEvent.change(slider, { target: { value: '48' } });

    expect(screen.getByText(/48 hours/i)).toBeDefined();
  });

  it('updates raw score and recalculates adjusted final grade', () => {
    render(<LatePenaltyAdvisor defaultRawScore={80} />);

    const rawSlider = screen.getByLabelText(/Expected Raw Score Slider/i);
    fireEvent.change(rawSlider, { target: { value: '90' } });

    expect(screen.getAllByText(/90%/i).length).toBeGreaterThanOrEqual(1);
  });

  it('switches slip days used and updates remaining slip count', () => {
    render(<LatePenaltyAdvisor />);

    const slipBtn = screen.getByText('2 Used');
    fireEvent.click(slipBtn);

    expect(screen.getByText(/0 slip days remaining/i)).toBeDefined();
  });
});
