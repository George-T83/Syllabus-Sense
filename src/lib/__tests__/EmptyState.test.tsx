import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { EmptyState } from '@/components/ui/EmptyState';

describe('EmptyState', () => {
  it('renders title and description', () => {
    render(
      <EmptyState icon={<span>icon</span>} title="Nothing here" description="Add something" />,
    );
    expect(screen.getByText('Nothing here')).toBeDefined();
    expect(screen.getByText('Add something')).toBeDefined();
  });

  it('omits the description when not provided', () => {
    render(<EmptyState icon={<span>icon</span>} title="Nothing here" />);
    expect(screen.queryByText('Add something')).toBeNull();
  });

  it('renders an action button and fires its onClick', () => {
    const onClick = vi.fn();
    render(
      <EmptyState
        icon={<span>icon</span>}
        title="Nothing here"
        action={{ label: 'Add one', onClick }}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add one' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('omits the action button when not provided', () => {
    render(<EmptyState icon={<span>icon</span>} title="Nothing here" />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});
