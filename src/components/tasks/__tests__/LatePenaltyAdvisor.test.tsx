import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LatePenaltyAdvisor } from '../LatePenaltyAdvisor';
import type { LatePolicyConfig } from '@/lib/policy/latePenalty';

// A policy a caller actually has (e.g. extracted from a syllabus).
const POLICY: LatePolicyConfig = {
  type: 'slip_days_grace',
  totalSlipDaysAllowed: 2,
  dailyDeductionPercent: 10,
  hardCutoffHours: 72,
  rawPolicyText: 'Two slip days, then 10% per day, nothing after 72 hours.',
};

describe('LatePenaltyAdvisor with a known policy', () => {
  it('renders the simulator, decay chart and the policy text it was given', () => {
    render(
      <LatePenaltyAdvisor
        courseCode="CS 301"
        assignmentTitle="Project 2: Trees"
        defaultRawScore={95}
        policy={POLICY}
      />,
    );

    expect(screen.getByText('Late Submission Penalty & Grace Advisor')).toBeDefined();
    expect(screen.getByText('CS 301')).toBeDefined();
    expect(screen.getByTestId('penalty-status-badge')).toBeDefined();
    expect(screen.getByRole('img')).toBeDefined();
    expect(screen.getByTestId('final-recorded-score')).toBeDefined();
    expect(screen.getByText(/Official Syllabus Late Policy/i)).toBeDefined();
    expect(screen.getByText(/Two slip days, then 10% per day/i)).toBeDefined();
  });

  it('updates live score calculation when hours late slider moves', () => {
    render(<LatePenaltyAdvisor defaultRawScore={100} policy={POLICY} />);

    fireEvent.change(screen.getByLabelText(/Hours Late Slider/i), { target: { value: '48' } });
    expect(screen.getByText(/48 hours/i)).toBeDefined();
  });

  it('updates raw score and recalculates adjusted final grade', () => {
    render(<LatePenaltyAdvisor defaultRawScore={80} policy={POLICY} />);

    fireEvent.change(screen.getByLabelText(/Expected Raw Score Slider/i), {
      target: { value: '90' },
    });
    expect(screen.getAllByText(/90%/i).length).toBeGreaterThanOrEqual(1);
  });

  it('offers exactly as many slip-day choices as the policy allows', () => {
    render(<LatePenaltyAdvisor policy={POLICY} />);

    expect(screen.getByText('0 Used')).toBeDefined();
    expect(screen.getByText('2 Used')).toBeDefined();
    expect(screen.queryByText('3 Used')).toBeNull();

    fireEvent.click(screen.getByText('2 Used'));
    expect(screen.getByText(/0 slip days remaining/i)).toBeDefined();
  });

  it('does not ask for a policy when one is provided', () => {
    render(<LatePenaltyAdvisor policy={POLICY} />);
    expect(screen.queryByLabelText(/Penalty per day late/i)).toBeNull();
  });
});

describe('LatePenaltyAdvisor with no policy on file', () => {
  it('assumes nothing: no calculator, no invented policy, no sample course or assignment', () => {
    render(<LatePenaltyAdvisor />);

    expect(screen.getByText(/does not have this course.s late policy on file/i)).toBeDefined();
    expect(screen.queryByText(/Official Syllabus Late Policy/i)).toBeNull();
    expect(screen.queryByText(/slip days per semester/i)).toBeNull();
    expect(screen.queryByText('CS 301')).toBeNull();
    expect(screen.queryByText(/Graph Algorithms/i)).toBeNull();
    expect(screen.queryByTestId('penalty-status-badge')).toBeNull();
    expect((screen.getByLabelText(/Penalty per day late/i) as HTMLInputElement).value).toBe('');
  });

  it('shows the calculator only after a penalty rate is entered, using exactly that policy', () => {
    render(<LatePenaltyAdvisor defaultRawScore={100} />);

    fireEvent.change(screen.getByLabelText(/Penalty per day late/i), { target: { value: '15' } });
    expect(screen.getByTestId('penalty-status-badge')).toBeDefined();

    // Default what-if is 24 hours late = 1 day = 15% under the entered policy.
    expect(screen.getByTestId('final-recorded-score').textContent).toMatch(/85%/);
    // The policy was typed in by the student, so it is never labelled "official".
    expect(screen.queryByText(/Official Syllabus Late Policy/i)).toBeNull();
  });

  it('applies entered slip days and a hard cutoff', () => {
    render(<LatePenaltyAdvisor defaultRawScore={100} />);

    fireEvent.change(screen.getByLabelText(/Penalty per day late/i), { target: { value: '10' } });
    fireEvent.change(screen.getByLabelText(/Free slip days/i), { target: { value: '1' } });
    // One day late is fully covered by the single slip day.
    expect(screen.getByTestId('final-recorded-score').textContent).toMatch(/100%/);

    fireEvent.change(screen.getByLabelText(/Zero credit after/i), { target: { value: '30' } });
    fireEvent.change(screen.getByLabelText(/Hours Late Slider/i), { target: { value: '48' } });
    expect(screen.getByTestId('final-recorded-score').textContent).toMatch(/0%/);
  });

  it('keeps the calculator hidden for a zero or out-of-range rate', () => {
    render(<LatePenaltyAdvisor />);
    const rate = screen.getByLabelText(/Penalty per day late/i);

    fireEvent.change(rate, { target: { value: '0' } });
    expect(screen.queryByTestId('penalty-status-badge')).toBeNull();
    fireEvent.change(rate, { target: { value: '150' } });
    expect(screen.queryByTestId('penalty-status-badge')).toBeNull();
  });
});
