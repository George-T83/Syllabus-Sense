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
  const mainGradId = `logo-main-grad-${uid}`;
  const tealGradId = `logo-teal-grad-${uid}`;

  return (
    <svg viewBox="0 0 200 200" className={className} role="img" aria-label="Syllabus Sense logo">
      <defs>
        <linearGradient id={mainGradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#8C6EFF" />
          <stop offset="100%" stopColor="#5B3DF5" />
        </linearGradient>
        <linearGradient id={tealGradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3DFFD0" />
          <stop offset="100%" stopColor="#00BFA0" />
        </linearGradient>
      </defs>
      <rect x="12" y="12" width="176" height="176" rx="44" fill={`url(#${mainGradId})`} />
      <circle cx="100" cy="100" r="72" fill="none" stroke="#FFFFFF" strokeWidth="11" />
      <polygon points="137,63 110,110 63,137" fill="#FFFFFF" />
      <polygon points="137,63 90,90 63,137" fill={`url(#${tealGradId})`} />
      <circle cx="100" cy="100" r="15" fill="#FFFFFF" />
      <circle cx="100" cy="100" r="8" fill="#5B3DF5" />
    </svg>
  );
}
