'use client';

import { useId } from 'react';

export default function Logo({ className }: { className?: string }) {
  // Gradient ids must be unique per rendered <Logo> - the auth pages render
  // one copy in the (hidden-on-mobile, but still DOM-present) brand panel
  // and another in the form card itself. With a shared hardcoded id, some
  // mobile browsers refuse to resolve a url(#id) gradient reference whose
  // first-in-DOM definition lives inside a display:none subtree, so the
  // visible logo's fill silently disappeared, leaving only the white ring
  // and center dot. useId() keeps every instance's ids distinct.
  const uid = useId();
  const markGradId = `logo-mark-grad-${uid}`;

  // A compass mark, not a plated app icon - a bare ring + a single-gradient
  // needle diamond, exactly the mark approved in the design concept
  // (claude.ai/artifact/4AvwgJrMEGmGDRMmVAEAPn). One gradient across the
  // whole needle, not the old logo's two-tone split - a two-color needle
  // sitting inside a one-color ring read as two unrelated marks stitched
  // together rather than one coherent glyph.
  return (
    <svg viewBox="0 0 200 200" className={className} role="img" aria-label="Syllabus Sense logo">
      <defs>
        <linearGradient id={markGradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#8C6EFF" />
          <stop offset="55%" stopColor="#5B3DF5" />
          <stop offset="100%" stopColor="#00BFA0" />
        </linearGradient>
      </defs>
      <circle
        cx="100"
        cy="100"
        r="82"
        fill="none"
        stroke={`url(#${markGradId})`}
        strokeWidth="11"
      />
      <polygon points="100,54 119,100 100,146 81,100" fill={`url(#${markGradId})`} />
      <circle cx="100" cy="100" r="14" fill="#FFFFFF" />
      <circle cx="100" cy="100" r="7" fill="#5B3DF5" />
    </svg>
  );
}
