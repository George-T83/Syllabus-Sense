import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { OfflineBanner } from '../OfflineBanner';

describe('OfflineBanner Component (Item 29)', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'onLine', {
      value: true,
      writable: true,
      configurable: true,
    });
  });

  it('renders nothing when client is normally online', () => {
    const { container } = render(<OfflineBanner />);
    expect(container.firstChild).toBeNull();
  });

  it('renders offline warning banner when browser goes offline', () => {
    render(<OfflineBanner />);

    act(() => {
      Object.defineProperty(navigator, 'onLine', { value: false });
      window.dispatchEvent(new Event('offline'));
    });

    const banner = screen.getByTestId('offline-network-banner');
    expect(banner).toBeDefined();
    expect(banner.getAttribute('role')).toBe('status');
    expect(banner.getAttribute('aria-live')).toBe('polite');
    expect(screen.getByText(/Offline Mode:/i)).toBeDefined();
    expect(screen.getByTestId('retry-connection-button')).toBeDefined();
  });

  it('renders connection restored banner when reconnecting', () => {
    render(<OfflineBanner reconnectNoticeDurationMs={5000} />);

    act(() => {
      Object.defineProperty(navigator, 'onLine', { value: false });
      window.dispatchEvent(new Event('offline'));
    });

    act(() => {
      Object.defineProperty(navigator, 'onLine', { value: true });
      window.dispatchEvent(new Event('online'));
    });

    const syncBanner = screen.getByTestId('online-sync-banner');
    expect(syncBanner).toBeDefined();
    expect(screen.getByText(/Connection restored!/i)).toBeDefined();
  });
});
