import { resolveCourseIcon } from '@/lib/courseIcons';

export interface CourseIconGlyphProps {
  icon: string | undefined;
  className?: string;
}

/** Renders one of COURSE_ICON_PRESETS as a stroked SVG glyph, at the same
 * 24x24/currentColor convention as TYPE_ICON_PATH and lib/icons.ts - built
 * as JSX (not path-string data) because a couple of these compose more
 * than one primitive (a chart's three bars, a globe's meridian), which is
 * simpler to get right as real SVG elements than as one <path> string. */
export function CourseIconGlyph({ icon, className = 'h-4 w-4' }: CourseIconGlyphProps) {
  const resolved = resolveCourseIcon(icon);
  const common = {
    className,
    viewBox: '0 0 24 24',
    fill: 'none' as const,
    stroke: 'currentColor',
    strokeWidth: 1.75,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  switch (resolved) {
    case 'calculator':
      return (
        <svg {...common}>
          <rect x="6" y="3" width="12" height="18" rx="2" />
          <line x1="9" y1="7" x2="15" y2="7" />
          <circle cx="9" cy="12" r="0.6" fill="currentColor" stroke="none" />
          <circle cx="12" cy="12" r="0.6" fill="currentColor" stroke="none" />
          <circle cx="15" cy="12" r="0.6" fill="currentColor" stroke="none" />
          <circle cx="9" cy="15.5" r="0.6" fill="currentColor" stroke="none" />
          <circle cx="12" cy="15.5" r="0.6" fill="currentColor" stroke="none" />
          <circle cx="15" cy="15.5" r="0.6" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'flask':
      return (
        <svg {...common}>
          <path d="M9 3h6M10 3v5.5L4.5 18a2 2 0 001.7 3h11.6a2 2 0 001.7-3L14 8.5V3" />
          <line x1="7.5" y1="14" x2="16.5" y2="14" />
        </svg>
      );
    case 'globe':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <ellipse cx="12" cy="12" rx="4" ry="9" />
        </svg>
      );
    case 'chat':
      return (
        <svg {...common}>
          <path d="M4 7a2 2 0 012-2h12a2 2 0 012 2v8a2 2 0 01-2 2H10l-4 3v-3H6a2 2 0 01-2-2V7z" />
        </svg>
      );
    case 'code':
      return (
        <svg {...common}>
          <path d="M9 8l-5 4 5 4M15 8l5 4-5 4" />
        </svg>
      );
    case 'chart':
      return (
        <svg {...common}>
          <line x1="3" y1="20" x2="21" y2="20" />
          <line x1="6" y1="20" x2="6" y2="14" />
          <line x1="12" y1="20" x2="12" y2="9" />
          <line x1="18" y1="20" x2="18" y2="5" />
        </svg>
      );
    case 'palette':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8" />
          <circle cx="9" cy="9.5" r="1" fill="currentColor" stroke="none" />
          <circle cx="15" cy="9.5" r="1" fill="currentColor" stroke="none" />
          <circle cx="9.5" cy="15" r="1" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'music':
      return (
        <svg {...common}>
          <circle cx="9" cy="18" r="2.2" />
          <path d="M11.2 18V4l7-1.5v4" />
        </svg>
      );
    case 'film':
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <line x1="7" y1="5" x2="7" y2="19" />
          <line x1="17" y1="5" x2="17" y2="19" />
          <line x1="3" y1="10" x2="7" y2="10" />
          <line x1="3" y1="14" x2="7" y2="14" />
          <line x1="17" y1="10" x2="21" y2="10" />
          <line x1="17" y1="14" x2="21" y2="14" />
        </svg>
      );
    case 'heart':
      return (
        <svg {...common}>
          <circle cx="9" cy="9" r="3.2" />
          <circle cx="15" cy="9" r="3.2" />
          <path d="M5.8 11.5L12 19l6.2-7.5" />
        </svg>
      );
    case 'scale':
      return (
        <svg {...common}>
          <line x1="12" y1="3" x2="12" y2="21" />
          <line x1="4" y1="7" x2="20" y2="7" />
          <line x1="7" y1="21" x2="17" y2="21" />
          <path d="M4 7l-2 5h4l-2-5zM20 7l-2 5h4l-2-5z" />
        </svg>
      );
    case 'bolt':
      return (
        <svg {...common}>
          <path d="M13 2L4 14h6l-1 8 9-13h-6l1-7z" />
        </svg>
      );
    case 'puzzle':
      return (
        <svg {...common}>
          <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      );
    case 'book':
    default:
      return (
        <svg {...common}>
          <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      );
  }
}
