import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RowActionButton } from '../RowActionButton';
import { BackLink } from '../BackLink';

describe('row-level touch targets', () => {
  it('keeps Edit/Delete pills at least 36px tall', () => {
    render(<RowActionButton>Edit</RowActionButton>);
    expect(screen.getByRole('button', { name: 'Edit' }).className).toContain('min-h-9');
  });

  it('keeps the back link at least 36px tall', () => {
    render(<BackLink href="/tasks">Back to tasks</BackLink>);
    expect(screen.getByRole('link', { name: 'Back to tasks' }).className).toContain('min-h-9');
  });
});
