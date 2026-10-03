import DOMPurify from 'dompurify';

/**
 * Makes mammoth's .docx-to-HTML output safe to put in the page.
 *
 * mammoth does not sanitise: a hyperlink in the document is copied into
 * `<a href>` as written, so a crafted .docx can carry `javascript:` or `data:`
 * links that run script on the app's origin when clicked. The student's own
 * upload is not trusted markup, so the output goes through an allow-list:
 * only the tags a Word document produces, only the attributes they need, and
 * only http(s) and mailto links.
 */

const ALLOWED_TAGS = [
  'a',
  'blockquote',
  'br',
  'em',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'img',
  'li',
  'ol',
  'p',
  'strong',
  'sub',
  'sup',
  'table',
  'tbody',
  'td',
  'th',
  'thead',
  'tr',
  'ul',
  'u',
  's',
];

const ALLOWED_ATTR = ['href', 'src', 'alt', 'colspan', 'rowspan'];

/** Links: http, https, mailto, or a same-page anchor. Nothing else. */
const LINK_PATTERN = /^(?:https?:|mailto:|#)/i;
/** Embedded pictures arrive as base64 data URIs; raster formats only, so an
 * SVG (which can carry script) is never accepted. */
const IMAGE_PATTERN = /^data:image\/(?:png|jpe?g|gif|webp|bmp);base64,/i;

let hooked = false;

function installHooks(): void {
  if (hooked) return;
  hooked = true;
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName === 'A') {
      const href = node.getAttribute('href');
      if (href !== null && !LINK_PATTERN.test(href.trim())) node.removeAttribute('href');
      if (node.hasAttribute('href')) {
        node.setAttribute('target', '_blank');
        node.setAttribute('rel', 'noopener noreferrer');
      }
    }
    if (node.tagName === 'IMG') {
      const src = node.getAttribute('src');
      if (src === null || !IMAGE_PATTERN.test(src)) node.remove();
    }
  });
}

const CONFIG = {
  ALLOWED_TAGS,
  ALLOWED_ATTR,
  // Links and images are checked in the hook above, so the library's own
  // URL filter must not be the only gate.
  ALLOW_DATA_ATTR: false,
  ALLOW_UNKNOWN_PROTOCOLS: false,
};

export function sanitizeDocxHtml(html: string): string {
  installHooks();
  const fragment = DOMPurify.sanitize(html, { ...CONFIG, RETURN_DOM_FRAGMENT: true });

  // A link whose address was refused is turned back into plain text, so the
  // viewer does not show something that looks clickable and does nothing.
  fragment.querySelectorAll('a:not([href])').forEach((a) => {
    a.replaceWith(...Array.from(a.childNodes));
  });

  const holder = document.createElement('div');
  holder.appendChild(fragment);
  // Serialising and re-parsing can change markup, so the result is sanitised
  // once more rather than trusted.
  return DOMPurify.sanitize(holder.innerHTML, CONFIG);
}
