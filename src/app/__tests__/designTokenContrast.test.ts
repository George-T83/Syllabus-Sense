import { readFileSync } from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

/**
 * WCAG 2.x contrast for the design-token pairs the app actually renders.
 *
 * Tokens are read straight out of src/app/globals.css (`:root` = light,
 * `.dark` = dark, which only overrides what it redefines), so a palette change
 * that drops a pair below its threshold fails here instead of in an audit.
 *
 *   - 4.5:1 for text (SC 1.4.3)
 *   - 3:1 for large text and UI components / graphical objects (SC 1.4.11)
 */

type Rgb = [number, number, number];
type Theme = 'light' | 'dark';

const css = readFileSync(path.resolve(__dirname, '../globals.css'), 'utf8');

/** Body of the first `selector { ... }` block that declares tokens. */
function blockBody(selector: string): string {
  const start = css.indexOf(`${selector} {`);
  if (start === -1) throw new Error(`globals.css has no ${selector} block`);
  let depth = 0;
  for (let i = css.indexOf('{', start); i < css.length; i++) {
    if (css[i] === '{') depth++;
    if (css[i] === '}' && --depth === 0) return css.slice(css.indexOf('{', start) + 1, i);
  }
  throw new Error(`Unterminated ${selector} block`);
}

function parseTokens(body: string): Record<string, string> {
  const tokens: Record<string, string> = {};
  for (const m of body.matchAll(/^\s*--([a-z0-9-]+):\s*([^;]+);/gm)) tokens[m[1]] = m[2].trim();
  return tokens;
}

const lightTokens = parseTokens(blockBody(':root'));
const darkTokens = { ...lightTokens, ...parseTokens(blockBody('.dark')) };

function hslToRgb(value: string): Rgb {
  const m = value.match(/^([\d.]+)\s+([\d.]+)%\s+([\d.]+)%$/);
  if (!m) throw new Error(`Not an "H S% L%" triplet: ${value}`);
  const h = Number(m[1]);
  const s = Number(m[2]) / 100;
  const l = Number(m[3]) / 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [f(0) * 255, f(8) * 255, f(4) * 255];
}

function luminance([r, g, b]: Rgb): number {
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(a: Rgb, b: Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function over(fg: Rgb, alpha: number, bg: Rgb): Rgb {
  return fg.map((c, i) => c * alpha + bg[i] * (1 - alpha)) as Rgb;
}

/** A colour layer: a token, optionally at partial opacity (Tailwind `/10`). */
interface Layer {
  token: string;
  alpha?: number;
}

function resolve(theme: Theme, layers: Layer[]): Rgb {
  const tokens = theme === 'light' ? lightTokens : darkTokens;
  let acc = hslToRgb(tokens['background']);
  for (const { token, alpha = 1 } of layers) acc = over(hslToRgb(tokens[token]), alpha, acc);
  return acc;
}

/**
 * Text colour token for a theme. In dark mode `text-primary` is remapped to
 * --primary-text (see `.dark .text-primary` in globals.css).
 */
function textToken(theme: Theme, token: string): string {
  return theme === 'dark' && token === 'primary' ? 'primary-text' : token;
}

interface Pair {
  name: string;
  /** Foreground token (text or UI component). */
  fg: string;
  /** Surfaces stacked bottom to top, e.g. page then a 10% tint. */
  bg: Layer[];
  min: 4.5 | 3;
}

const page: Layer = { token: 'background' };
const card: Layer = { token: 'card' };

const textOn = (fg: string, bg: Layer[], name: string): Pair => ({ name, fg, bg, min: 4.5 });

const pairs: Pair[] = [
  // Body text on every neutral surface.
  textOn('foreground', [page], 'foreground on background'),
  textOn('foreground', [card], 'foreground on card'),
  textOn('foreground', [page, { token: 'muted' }], 'foreground on muted'),
  textOn('foreground', [page, { token: 'accent' }], 'foreground on accent'),
  textOn('card-foreground', [card], 'card-foreground on card'),
  textOn(
    'secondary-foreground',
    [page, { token: 'secondary' }],
    'secondary-foreground on secondary',
  ),
  textOn('accent-foreground', [page, { token: 'accent' }], 'accent-foreground on accent'),

  // Muted (secondary) text: the most-used low-emphasis colour in the app.
  textOn('muted-foreground', [page], 'muted-foreground on background'),
  textOn('muted-foreground', [card], 'muted-foreground on card'),
  textOn('muted-foreground', [page, { token: 'muted' }], 'muted-foreground on muted'),
  textOn('muted-foreground', [page, { token: 'accent' }], 'muted-foreground on accent'),
  textOn('muted-foreground', [page, { token: 'secondary' }], 'muted-foreground on secondary'),
  textOn(
    'muted-foreground',
    [card, { token: 'muted', alpha: 0.5 }],
    'muted-foreground on muted/50 over card',
  ),
  textOn('muted-foreground', [{ token: 'input' }], 'muted-foreground on input (placeholder)'),

  // Buttons / badges with a solid fill.
  textOn('primary-foreground', [page, { token: 'primary' }], 'primary-foreground on primary'),
  textOn(
    'destructive-foreground',
    [page, { token: 'destructive' }],
    'destructive-foreground on destructive',
  ),

  // Brand-coloured text (`text-primary`) on surfaces and on its own tints.
  textOn('primary', [page], 'text-primary on background'),
  textOn('primary', [card], 'text-primary on card'),
  textOn('primary', [page, { token: 'accent' }], 'text-primary on accent'),
  textOn(
    'primary',
    [card, { token: 'primary', alpha: 0.1 }],
    'text-primary on primary/10 over card',
  ),
  textOn(
    'primary',
    [page, { token: 'primary', alpha: 0.1 }],
    'text-primary on primary/10 over background',
  ),
  textOn(
    'primary',
    [card, { token: 'primary', alpha: 0.2 }],
    'text-primary on primary/20 over card',
  ),

  // Destructive text and badges.
  textOn('destructive', [page], 'text-destructive on background'),
  textOn('destructive', [card], 'text-destructive on card'),
  textOn(
    'destructive',
    [card, { token: 'destructive', alpha: 0.1 }],
    'text-destructive on destructive/10 over card',
  ),
  textOn(
    'destructive',
    [page, { token: 'destructive', alpha: 0.1 }],
    'text-destructive on destructive/10 over background',
  ),
  textOn('destructive', [page, { token: 'accent' }], 'text-destructive on accent'),
  textOn(
    'destructive',
    [card, { token: 'destructive', alpha: 0.2 }],
    'text-destructive on destructive/20 over card',
  ),

  // Workload status colours: text on the surface and on their own 10% badge.
  ...['low', 'medium', 'high', 'critical'].flatMap((level) => {
    const token = `load-${level}`;
    return [
      textOn(token, [page], `text-${token} on background`),
      textOn(token, [card], `text-${token} on card`),
      textOn(token, [card, { token, alpha: 0.1 }], `text-${token} on ${token}/10 over card`),
      textOn(token, [page, { token, alpha: 0.1 }], `text-${token} on ${token}/10 over background`),
      textOn(token, [card, { token, alpha: 0.15 }], `text-${token} on ${token}/15 over card`),
    ];
  }),

  // UI components / graphical objects (3:1): fills that carry meaning.
  { name: 'primary fill vs card (UI)', fg: 'primary', bg: [card], min: 3 },
  { name: 'primary fill vs background (UI)', fg: 'primary', bg: [page], min: 3 },
  { name: 'destructive fill vs card (UI)', fg: 'destructive', bg: [card], min: 3 },
  ...['low', 'medium', 'high', 'critical'].map((level): Pair => ({
    name: `load-${level} fill vs card (UI)`,
    fg: `load-${level}`,
    bg: [card],
    min: 3,
  })),
];

function ratio(theme: Theme, pair: Pair): number {
  const tokens = theme === 'light' ? lightTokens : darkTokens;
  const fgToken = pair.min === 4.5 ? textToken(theme, pair.fg) : pair.fg;
  const bg = resolve(theme, pair.bg);
  // Text tokens are opaque, so no compositing of the foreground is needed.
  return contrast(hslToRgb(tokens[fgToken]), bg);
}

describe('design token contrast (globals.css)', () => {
  it('parses both themes', () => {
    expect(lightTokens['background']).toBeDefined();
    expect(darkTokens['background']).not.toBe(lightTokens['background']);
    expect(darkTokens['primary-text']).toBeDefined();
  });

  for (const theme of ['light', 'dark'] as const) {
    describe(`${theme} theme`, () => {
      it.each(pairs.map((p) => [p.name, p] as const))('%s', (_name, pair) => {
        const value = ratio(theme, pair);
        expect(
          value,
          `${pair.name} (${theme}) is ${value.toFixed(2)}:1, needs ${pair.min}:1`,
        ).toBeGreaterThanOrEqual(pair.min);
      });
    });
  }
});
