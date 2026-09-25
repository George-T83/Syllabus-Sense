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

  // The same plated compass mark as the favicon/app icons (src/app/icon.svg,
  // scripts/generate-pwa-icons.mjs) - one consistent glyph everywhere the
  // logo appears, rather than a bare navbar-only version and a differently-
  // plated icon version. Gradient plate, white ring + needle, colored center
  // dot; identical geometry to icon.svg so this and the favicon never drift.
  return (
    <svg viewBox="0 0 200 200" className={className} role="img" aria-label="Syllabus Sense logo">
      <defs>
        <linearGradient id={markGradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#8C6EFF" />
          <stop offset="55%" stopColor="#5B3DF5" />
          <stop offset="100%" stopColor="#00BFA0" />
        </linearGradient>
      </defs>
      <rect x="12" y="12" width="176" height="176" rx="44" fill={`url(#${markGradId})`} />
      <circle cx="100" cy="100" r="72" fill="none" stroke="#FFFFFF" strokeWidth="11" />
      <polygon points="100,60 117,100 100,140 83,100" fill="#FFFFFF" />
      <circle cx="100" cy="100" r="13" fill="#FFFFFF" />
      <circle cx="100" cy="100" r="6.5" fill="#5B3DF5" />
    </svg>
  );
}
