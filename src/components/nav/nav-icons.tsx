// Line icons for the primary navigation. Hand-drawn at 20px on a 20-unit
// grid, 1.5 stroke, currentColor, so they follow the link's text color.

type IconProps = { className?: string };

function Svg({ className, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 20 20"
      width={20}
      height={20}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      {children}
    </svg>
  );
}

export function DashboardIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3" y="3" width="6" height="8" rx="1.5" />
      <rect x="11" y="3" width="6" height="5" rx="1.5" />
      <rect x="3" y="13" width="6" height="4" rx="1.5" />
      <rect x="11" y="10" width="6" height="7" rx="1.5" />
    </Svg>
  );
}

/** Three candles: the product's own shape. */
export function PracticeIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5 3v14M10 2v16M15 4v12" />
      <rect x="3.5" y="6" width="3" height="6" rx="0.75" />
      <rect x="8.5" y="5" width="3" height="8" rx="0.75" />
      <rect x="13.5" y="8" width="3" height="5" rx="0.75" />
    </Svg>
  );
}

/** Circular arrow: go back over it. */
export function MistakesIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3.5 10a6.5 6.5 0 1 0 2-4.7" />
      <path d="M3.5 3v3.5H7" />
      <path d="M10 7v3.5l2 1.5" />
    </Svg>
  );
}

export function AnalyticsIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3 17h14" />
      <path d="M5.5 14V9M10 14V5M14.5 14v-3" />
    </Svg>
  );
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m6 8 4 4 4-4" />
    </Svg>
  );
}
