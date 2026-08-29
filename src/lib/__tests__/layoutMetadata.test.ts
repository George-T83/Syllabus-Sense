import { describe, it, expect, vi } from 'vitest';

vi.mock('next/font/local', () => ({
  default: () => ({
    variable: '--mock-font',
  }),
}));

import { metadata, viewport } from '@/app/layout';

describe('Root Layout PWA Viewport & Metadata (Item 27)', () => {
  it('exports valid PWA viewport configuration with responsive scaling and theme-color media queries', () => {
    expect(viewport).toBeDefined();
    expect(viewport.width).toBe('device-width');
    expect(viewport.initialScale).toBe(1);
    expect(viewport.maximumScale).toBe(5);
    expect(viewport.userScalable).toBe(true);

    expect(Array.isArray(viewport.themeColor)).toBe(true);
    const themeColors = viewport.themeColor as Array<{
      media?: string;
      color: string;
    }>;
    const lightTheme = themeColors.find((t) =>
      t.media?.includes('prefers-color-scheme: light')
    );
    const darkTheme = themeColors.find((t) =>
      t.media?.includes('prefers-color-scheme: dark')
    );

    expect(lightTheme).toBeDefined();
    expect(lightTheme?.color).toBe('#FFFFFF');
    expect(darkTheme).toBeDefined();
    expect(darkTheme?.color).toBe('#090D16');
  });

  it('exports comprehensive metadata with appleWebApp and manifest links', () => {
    expect(metadata).toBeDefined();
    expect(metadata.applicationName).toBe('Syllabus Sense');
    expect(metadata.manifest).toBe('/manifest.webmanifest');

    expect(metadata.appleWebApp).toEqual({
      capable: true,
      statusBarStyle: 'black-translucent',
      title: 'Syllabus Sense',
    });
  });

  it('configures standard icon and apple-touch-icon suites in metadata', () => {
    const icons = metadata.icons as {
      icon?: Array<{ url: string; sizes?: string; type?: string }>;
      apple?: Array<{ url: string; sizes?: string; type?: string }>;
    };

    expect(icons).toBeDefined();
    expect(icons.icon).toBeDefined();
    expect(icons.apple).toBeDefined();

    const appleIcon = icons.apple?.find((a) =>
      a.url.includes('apple-touch-icon')
    );
    expect(appleIcon).toBeDefined();
    expect(appleIcon?.sizes).toBe('180x180');
  });
});
