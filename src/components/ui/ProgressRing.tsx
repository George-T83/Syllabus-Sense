export interface ProgressRingProps {
  /** 0-100 */
  percent: number;
  size?: number;
  strokeWidth?: number;
  children?: React.ReactNode;
}

/** Circular progress indicator using the same gradient as the brand mark
 * (Logo.tsx / .bg-gradient-brand), so "progress" reads as a hero brand
 * moment instead of a flat percentage number. */
export function ProgressRing({ percent, size = 96, strokeWidth = 8, children }: ProgressRingProps) {
  const clamped = Math.min(100, Math.max(0, percent));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped / 100);
  const gradientId = 'progress-ring-brand-grad';

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#8c6eff" />
            <stop offset="55%" stopColor="#5b3df5" />
            <stop offset="100%" stopColor="#00bfa0" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-[stroke-dashoffset] duration-500 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
}
