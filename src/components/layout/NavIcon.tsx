import { NAV_ICON_PATHS, type NavIconKey } from '@/lib/icons';

export interface NavIconProps {
  name: NavIconKey;
  className?: string;
}

export function NavIcon({ name, className = 'h-5 w-5' }: NavIconProps) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d={NAV_ICON_PATHS[name]} />
    </svg>
  );
}

/** Degree Compass's icon is a circle + a separate compass-needle path, so it
 * can't be expressed as the single `d` string every other nav icon uses. */
export function DegreeNavIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <circle cx="12" cy="12" r="9" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 9l-2 5-5 2 2-5 5-2z" />
    </svg>
  );
}
