import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RingGauge } from '../RingGauge';

describe('RingGauge', () => {
  it('renders as an accessible progressbar with the given bounds', () => {
    render(
      <RingGauge
        progress={0.5}
        level="medium"
        aria-label="Test gauge"
        aria-valuenow={2}
        aria-valuemin={0}
        aria-valuemax={4}
      >
        <span>2/4</span>
      </RingGauge>,
    );

    const gauge = screen.getByRole('progressbar');
    expect(gauge.getAttribute('aria-label')).toBe('Test gauge');
    expect(gauge.getAttribute('aria-valuenow')).toBe('2');
    expect(gauge.getAttribute('aria-valuemax')).toBe('4');
    expect(screen.getByText('2/4')).toBeDefined();
  });

  it('renders no needle by default, even with progress above zero', () => {
    const { container } = render(<RingGauge progress={0.75} level="critical" />);
    expect(container.querySelectorAll('polygon').length).toBe(0);
  });

  it('omits the needle at zero progress even when explicitly requested', () => {
    const { container } = render(<RingGauge progress={0} level="low" needle />);
    expect(container.querySelectorAll('polygon').length).toBe(0);
  });

  it('renders a needle polygon when explicitly requested and progress is above zero', () => {
    const { container } = render(<RingGauge progress={0.75} level="critical" needle />);
    expect(container.querySelectorAll('polygon').length).toBe(1);
  });

  it('clamps out-of-range progress values into 0-1', () => {
    const { container: over } = render(<RingGauge progress={1.5} level="high" needle />);
    const { container: under } = render(<RingGauge progress={-0.5} level="low" needle />);
    expect(over.querySelectorAll('polygon').length).toBe(1);
    expect(under.querySelectorAll('polygon').length).toBe(0);
  });

  it('colors the arc with the brand gradient in "brand" variant instead of a semantic class', () => {
    const { container } = render(<RingGauge progress={0.5} variant="brand" />);
    const arc = container.querySelectorAll('circle')[1];
    expect(arc.getAttribute('stroke')).toMatch(/^url\(#ring-gauge-grad-/);
    expect(arc.getAttribute('class')).not.toMatch(/stroke-load-/);
  });

  it('defaults to the semantic level class when no variant is given', () => {
    const { container } = render(<RingGauge progress={0.5} level="critical" />);
    const arc = container.querySelectorAll('circle')[1];
    expect(arc.getAttribute('class')).toMatch(/stroke-load-critical/);
    expect(arc.getAttribute('stroke')).toBeNull();
  });
});
