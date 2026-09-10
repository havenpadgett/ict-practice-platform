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
  const barColor = accuracy >= 70 ? "#4caf82" : accuracy >= 40 ? "#4c82fb" : "#e2685f";

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="truncate text-foreground">{label}</span>
        <span className="shrink-0 text-muted">
          {accuracy}%{sublabel ? <span className="ml-2 text-xs">{sublabel}</span> : null}
        </span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-line">
        <div
          className="h-full rounded-full"
          style={{ width: `${accuracy}%`, backgroundColor: barColor }}
        />
      </div>
    </div>
  );
}
