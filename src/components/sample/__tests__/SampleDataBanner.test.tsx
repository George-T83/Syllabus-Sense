import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { SampleDataBanner } from '../SampleDataBanner';

function renderBanner(props: Partial<Parameters<typeof SampleDataBanner>[0]> = {}) {
  const onRemove = vi.fn();
  const onUploadSyllabus = vi.fn();
  render(<SampleDataBanner onRemove={onRemove} onUploadSyllabus={onUploadSyllabus} {...props} />);
  return { onRemove, onUploadSyllabus };
}

describe('SampleDataBanner', () => {
  it('says plainly that this is sample data', () => {
    renderBanner();
    expect(
      screen.getByText(
        "You're looking at sample data. Add your own syllabus whenever you're ready.",
      ),
    ).toBeTruthy();
  });

  it('is not dismissible', () => {
    renderBanner();
    expect(screen.queryByRole('button', { name: /dismiss|hide|close/i })).toBeNull();
  });

  it('opens the syllabus upload', () => {
    const { onUploadSyllabus } = renderBanner();
    fireEvent.click(screen.getByRole('button', { name: /upload a syllabus/i }));
    expect(onUploadSyllabus).toHaveBeenCalledTimes(1);
  });

  it('asks before removing, and removes only after confirming', async () => {
    const { onRemove } = renderBanner();
    fireEvent.click(screen.getByRole('button', { name: 'Remove sample data' }));
    expect(onRemove).not.toHaveBeenCalled();
    expect(screen.getByText(/remove all sample courses, tasks and contacts/i)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(onRemove).toHaveBeenCalledTimes(1));
  });

  it('cancelling the confirm removes nothing', () => {
    const { onRemove } = renderBanner();
    fireEvent.click(screen.getByRole('button', { name: 'Remove sample data' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onRemove).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Remove sample data' })).toBeTruthy();
  });
});
