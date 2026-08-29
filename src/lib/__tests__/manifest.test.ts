import { describe, it, expect } from 'vitest';
import manifest from '@/app/manifest';
import fs from 'fs';
import path from 'path';

describe('Web App Manifest (Item 26)', () => {
  it('returns valid PWA manifest configuration with required metadata fields', () => {
    const config = manifest();

    expect(config.name).toBe('Syllabus Sense - AI Academic Planning & Schedule Command Center');
    expect(config.short_name).toBe('SyllabusSense');
    expect(config.start_url).toBe('/');
    expect(config.display).toBe('standalone');
    expect(config.orientation).toBe('portrait-primary');
    expect(config.background_color).toBe('#090D16');
    expect(config.theme_color).toBe('#5B3DF5');
    expect(config.categories).toContain('education');
    expect(config.categories).toContain('productivity');
  });

  it('includes standard and maskable icons for PWA installation (192, 512, apple-touch)', () => {
    const config = manifest();
    const icons = config.icons ?? [];

    expect(icons.length).toBeGreaterThanOrEqual(4);

    const maskable192 = icons.find((i) => i.sizes === '192x192' && i.purpose === 'maskable');
    const maskable512 = icons.find((i) => i.sizes === '512x512' && i.purpose === 'maskable');
    const any192 = icons.find((i) => i.sizes === '192x192' && i.purpose === 'any');
    const any512 = icons.find((i) => i.sizes === '512x512' && i.purpose === 'any');
    const appleTouch = icons.find((i) => i.sizes === '180x180' && i.src.includes('apple-touch'));

    expect(maskable192).toBeDefined();
    expect(maskable512).toBeDefined();
    expect(any192).toBeDefined();
    expect(any512).toBeDefined();
    expect(appleTouch).toBeDefined();
  });

  it('includes app shortcuts for key navigation destinations', () => {
    const config = manifest();
    const shortcuts = config.shortcuts ?? [];

    expect(shortcuts.length).toBeGreaterThanOrEqual(4);
    const shortcutUrls = shortcuts.map((s) => s.url);
    expect(shortcutUrls).toContain('/dashboard');
    expect(shortcutUrls).toContain('/tasks');
    expect(shortcutUrls).toContain('/calendar');
    expect(shortcutUrls).toContain('/courses');
  });

  it('verifies all referenced icon assets exist on disk in public/', () => {
    const config = manifest();
    const icons = config.icons ?? [];

    for (const icon of icons) {
      if (icon.src.startsWith('/icons/')) {
        const filePath = path.join(process.cwd(), 'public', icon.src);
        expect(fs.existsSync(filePath)).toBe(true);
        const stats = fs.statSync(filePath);
        expect(stats.size).toBeGreaterThan(0);
      } else if (icon.src === '/icon.svg') {
        const filePath = path.join(process.cwd(), 'src', 'app', 'icon.svg');
        expect(fs.existsSync(filePath)).toBe(true);
      }
    }
  });
});
