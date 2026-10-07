import { describe, it, expect, vi, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import { ServiceWorkerRegistration } from '../ServiceWorkerRegistration';

const register = vi.fn().mockResolvedValue({});

function withServiceWorker() {
  Object.defineProperty(navigator, 'serviceWorker', {
    value: { register },
    configurable: true,
  });
}

afterEach(() => {
  vi.unstubAllEnvs();
  register.mockClear();
  // @ts-expect-error cleaning up the test double
  delete navigator.serviceWorker;
});

describe('ServiceWorkerRegistration', () => {
  it('registers the worker for the whole site in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    withServiceWorker();
    render(<ServiceWorkerRegistration />);
    expect(register).toHaveBeenCalledWith('/sw.js', { scope: '/' });
  });

  it('stays out of the way in development', () => {
    vi.stubEnv('NODE_ENV', 'development');
    withServiceWorker();
    render(<ServiceWorkerRegistration />);
    expect(register).not.toHaveBeenCalled();
  });

  it('does nothing where service workers do not exist', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(() => render(<ServiceWorkerRegistration />)).not.toThrow();
  });

  it('survives a registration that fails', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    register.mockRejectedValueOnce(new Error('blocked'));
    withServiceWorker();
    render(<ServiceWorkerRegistration />);
    await Promise.resolve();
    expect(register).toHaveBeenCalledTimes(1);
  });
});
