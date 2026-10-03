import { readFileSync } from 'fs';
import path from 'path';
import { describe, it, expect } from 'vitest';
import mammoth from 'mammoth';
import { sanitizeDocxHtml } from '../sanitizeDocxHtml';

function parse(html: string): HTMLElement {
  const root = document.createElement('div');
  root.innerHTML = sanitizeDocxHtml(html);
  return root;
}

describe('sanitizeDocxHtml: links', () => {
  it.each([
    ['javascript:', `javascript:alert(1)`],
    ['mixed case', `JaVaScRiPt:alert(1)`],
    ['whitespace-obfuscated', `  java\tscript:alert(1)`],
    ['data:', `data:text/html,<script>alert(1)</script>`],
    ['vbscript:', `vbscript:msgbox(1)`],
    ['file:', `file:///etc/passwd`],
  ])('turns a %s link into plain text', (_label, href) => {
    const root = parse(`<p><a href="${href}">Rubric</a></p>`);
    expect(root.querySelector('a')).toBeNull();
    expect(root.textContent).toBe('Rubric');
  });

  it('keeps http, https and mailto links, opening them safely in a new tab', () => {
    const root = parse(
      '<p><a href="https://example.edu/c">A</a><a href="http://example.edu">B</a><a href="mailto:p@example.edu">C</a></p>',
    );
    const links = Array.from(root.querySelectorAll('a'));
    expect(links.map((l) => l.getAttribute('href'))).toEqual([
      'https://example.edu/c',
      'http://example.edu',
      'mailto:p@example.edu',
    ]);
    links.forEach((l) => {
      expect(l.getAttribute('target')).toBe('_blank');
      expect(l.getAttribute('rel')).toBe('noopener noreferrer');
    });
  });
});

describe('sanitizeDocxHtml: markup', () => {
  it('removes scripts, event handlers, frames and other active content', () => {
    const root = parse(
      '<p onclick="x()">Hi</p><script>alert(1)</script><iframe src="https://x"></iframe>' +
        '<object data="x"></object><form action="/x"><input></form><style>p{}</style>' +
        '<svg onload="x()"><script>x()</script></svg><math></math>',
    );
    expect(root.querySelector('script, iframe, object, form, input, style, svg, math')).toBeNull();
    expect(root.querySelector('p')?.getAttribute('onclick')).toBeNull();
    expect(root.textContent).toBe('Hi');
  });

  it('keeps the structure a Word document produces', () => {
    const html =
      '<h1>T</h1><p><strong>b</strong><em>i</em><u>u</u><sup>1</sup></p><ul><li>x</li></ul><ol><li>y</li></ol>' +
      '<table><thead><tr><th>H</th></tr></thead><tbody><tr><td colspan="2">C</td></tr></tbody></table>';
    const root = parse(html);
    expect(root.querySelector('h1')?.textContent).toBe('T');
    expect(root.querySelector('strong')).not.toBeNull();
    expect(root.querySelectorAll('li')).toHaveLength(2);
    expect(root.querySelector('td')?.getAttribute('colspan')).toBe('2');
  });

  it('leaves escaped markup as text', () => {
    const root = parse('<p>&lt;img src=x onerror=alert(1)&gt; stays text</p>');
    expect(root.querySelector('img')).toBeNull();
    expect(root.textContent).toBe('<img src=x onerror=alert(1)> stays text');
  });
});

describe('sanitizeDocxHtml: images', () => {
  const PNG = 'data:image/png;base64,iVBORw0KGgo=';

  it('keeps an embedded raster image', () => {
    const root = parse(`<p><img src="${PNG}" alt="logo"></p>`);
    expect(root.querySelector('img')?.getAttribute('src')).toBe(PNG);
    expect(root.querySelector('img')?.getAttribute('alt')).toBe('logo');
  });

  it.each([
    ['svg data URI', 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4='],
    ['remote image', 'https://tracker.example/pixel.png'],
    ['javascript src', 'javascript:alert(1)'],
    ['html data URI', 'data:text/html;base64,PHNjcmlwdD48L3NjcmlwdD4='],
  ])('removes an image with a %s source', (_label, src) => {
    expect(parse(`<p><img src="${src}"></p>`).querySelector('img')).toBeNull();
  });

  it('removes an image onerror handler', () => {
    const root = parse(`<img src="${PNG}" onerror="alert(1)">`);
    expect(root.querySelector('img')?.getAttribute('onerror')).toBeNull();
  });
});

describe('sanitizeDocxHtml: a real crafted .docx', () => {
  it('neutralises hostile hyperlinks end to end through mammoth', async () => {
    const buffer = readFileSync(path.join(__dirname, 'fixtures/evil-links.docx'));
    const converted = await mammoth.convertToHtml({ buffer });
    // mammoth copies the hostile link through unchanged...
    expect(converted.value).toContain('href="javascript:');
    expect(converted.value).toContain('href="data:text/html');

    // ...and the sanitiser removes it while keeping the safe ones.
    const root = parse(converted.value);
    const hrefs = Array.from(root.querySelectorAll('a')).map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual(['mailto:prof@example.edu', 'https://example.edu/course']);
    // The refused links stay readable, just no longer clickable.
    expect(root.textContent).toContain('Click for the grading rubric');
    expect(root.textContent).toContain('Data link');
    expect(root.querySelector('img')).toBeNull();
  });
});
