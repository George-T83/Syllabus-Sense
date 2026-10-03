import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ShortcutsCheatSheet } from '../ShortcutsCheatSheet';

describe('ShortcutsCheatSheet', () => {
  it('renders nothing while closed', () => {
    render(<ShortcutsCheatSheet open={false} onClose={vi.fn()} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('lists every shortcut with its keys, and does not mention Copilot', () => {
    render(<ShortcutsCheatSheet open={true} onClose={vi.fn()} />);
    const dialog = screen.getByRole('dialog', { name: 'Keyboard shortcuts' });
    expect(dialog.textContent).toContain('Open the command palette');
    expect(dialog.textContent).toContain('Ctrl+K');
    expect(dialog.textContent).toContain('Open the AI Advisor chat');
    expect(dialog.textContent).toContain('Alt+A');
    expect(dialog.textContent).toContain('Alt+P');
    expect(dialog.textContent).toContain('Flip the card');
    expect(dialog.textContent).not.toMatch(/Copilot/);
  });

  it('closes with the Close button, Escape, and a click on the backdrop', () => {
    const onClose = vi.fn();
    render(<ShortcutsCheatSheet open={true} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Close keyboard shortcuts' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.click(screen.getByRole('dialog'));
    expect(onClose).toHaveBeenCalledTimes(3);
  });
});
