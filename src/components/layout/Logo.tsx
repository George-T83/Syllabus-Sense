export default function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 200" className={className} role="img" aria-label="Syllabus Sense logo">
      <defs>
        <linearGradient id="logo-main-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#8C6EFF" />
          <stop offset="100%" stopColor="#5B3DF5" />
        </linearGradient>
        <linearGradient id="logo-teal-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3DFFD0" />
          <stop offset="100%" stopColor="#00BFA0" />
        </linearGradient>
      </defs>
      <rect x="12" y="12" width="176" height="176" rx="44" fill="url(#logo-main-grad)" />
      <circle cx="100" cy="100" r="72" fill="none" stroke="#FFFFFF" strokeWidth="11" />
      <polygon points="137,63 110,110 63,137" fill="#FFFFFF" />
      <polygon points="137,63 90,90 63,137" fill="url(#logo-teal-grad)" />
      <circle cx="100" cy="100" r="15" fill="#FFFFFF" />
      <circle cx="100" cy="100" r="8" fill="#5B3DF5" />
    </svg>
  );
}
