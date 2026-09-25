// Shared horizontal bar used by both the concept and exercise accuracy
// views — a labeled row with a percentage-filled track, no charting
// library, consistent with the hand-built candlestick chart elsewhere.

export function AccuracyBar({
  label,
  accuracy,
  sublabel,
}: {
  label: string;
  accuracy: number;
  sublabel?: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="truncate text-foreground">{label}</span>
        <span className="shrink-0 tabular-nums text-foreground">
          {accuracy}%{sublabel ? <span className="ml-2 text-xs text-muted">{sublabel}</span> : null}
        </span>
      </div>
      {/* One neutral fill: the number carries the value, so the bar never
          relies on a traffic-light color to say good or bad. */}
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line" aria-hidden>
        <div className="h-full rounded-full bg-muted" style={{ width: `${accuracy}%` }} />
      </div>
    </div>
  );
}
