// Time context layers for CandlestickChart, rendered only when every candle
// carries a timestamp (src/lib/time-context.ts). Split in two so shading and
// separators sit behind the candles while the axis labels sit on top.

import {
  formatEtTime,
  formatTradingDate,
  overlapsNyAm,
  tradingDate,
  tradingWeek,
  type TimeContext,
} from "@/lib/time-context";

type Bounds = { left: number; right: number; top: number; bottom: number };

/** NY AM shading is only meaningful when a candle is short enough that
 * "overlaps the session" doesn't mean "mostly outside it" — on a 4h chart a
 * shaded 06:00 bar would claim 2.5 hours that aren't the session. */
const MAX_SHADED_TIMEFRAME_MINUTES = 60;
/** Minimum spacing between x-axis labels, in viewBox units. */
const LABEL_MIN_SPACING = 64;

type Run = { start: number; end: number };

function nyAmRuns(ctx: TimeContext): Run[] {
  if (ctx.timeframeMinutes > MAX_SHADED_TIMEFRAME_MINUTES) return [];
  const runs: Run[] = [];
  ctx.parts.forEach((p, i) => {
    if (!overlapsNyAm(p, ctx.timeframeMinutes)) return;
    const last = runs[runs.length - 1];
    if (last && last.end === i - 1) last.end = i;
    else runs.push({ start: i, end: i });
  });
  return runs;
}

/** Indices where a new trading day (or week) starts. */
function boundaries(ctx: TimeContext): { index: number; newWeek: boolean }[] {
  const result: { index: number; newWeek: boolean }[] = [];
  for (let i = 1; i < ctx.parts.length; i++) {
    if (tradingDate(ctx.parts[i]) !== tradingDate(ctx.parts[i - 1])) {
      result.push({ index: i, newWeek: tradingWeek(ctx.parts[i]) !== tradingWeek(ctx.parts[i - 1]) });
    }
  }
  return result;
}

export function ChartTimeBackground({
  ctx,
  bounds,
  slotW,
}: {
  ctx: TimeContext;
  bounds: Bounds;
  slotW: number;
}) {
  const xAt = (index: number) => bounds.left + slotW * index;
  return (
    <g>
      {nyAmRuns(ctx).map((run) => (
        <g key={`ny-${run.start}`}>
          <rect
            x={xAt(run.start)}
            y={bounds.top}
            width={slotW * (run.end - run.start + 1)}
            height={bounds.bottom - bounds.top}
            className="fill-foreground/[0.035]"
          />
          <text x={xAt(run.start) + 3} y={bounds.top + 10} className="chart-tag fill-muted">
            NY AM
          </text>
        </g>
      ))}
      {boundaries(ctx).map(({ index, newWeek }) => (
        <line
          key={`day-${index}`}
          x1={xAt(index)}
          x2={xAt(index)}
          y1={bounds.top}
          y2={bounds.bottom}
          className={newWeek ? "stroke-muted" : "stroke-muted/50"}
          strokeWidth={newWeek ? 1.5 : 1}
          strokeDasharray={newWeek ? undefined : "3 4"}
        />
      ))}
    </g>
  );
}

export function ChartTimeLabels({
  ctx,
  bounds,
  slotW,
  hideDates = false,
}: {
  ctx: TimeContext;
  bounds: Bounds;
  slotW: number;
  /** Label day starts with the time instead of the date — Free Trade on real
   * data, where a date would let the user look up what happened next. */
  hideDates?: boolean;
}) {
  // Day-boundary labels win; plain time labels fill the gaps between them
  // wherever there's room.
  const dayStarts = [0, ...boundaries(ctx).map((b) => b.index)];
  const every = Math.max(1, Math.ceil(LABEL_MIN_SPACING / slotW));
  const labels: { index: number; text: string; isDate: boolean }[] = dayStarts.map((index) => ({
    index,
    text: hideDates ? formatEtTime(ctx.parts[index]) : formatTradingDate(tradingDate(ctx.parts[index])),
    isDate: true,
  }));
  for (let i = 0; i < ctx.parts.length; i += every) {
    const x = slotW * i;
    if (labels.some((l) => Math.abs(slotW * l.index - x) < LABEL_MIN_SPACING)) continue;
    labels.push({ index: i, text: formatEtTime(ctx.parts[i]), isDate: false });
  }
  // On a collision a date beats a time, and a later date beats an earlier
  // one (a partial first day squeezed against the left edge is the least
  // informative label on the chart).
  const placed: typeof labels = [];
  for (const label of labels.sort((a, b) => a.index - b.index)) {
    const prev = placed[placed.length - 1];
    if (prev && slotW * (label.index - prev.index) < LABEL_MIN_SPACING) {
      if (label.isDate) placed[placed.length - 1] = label;
      continue;
    }
    placed.push(label);
  }

  return (
    <g>
      {placed.map((label) => (
        <text
          key={`lbl-${label.index}`}
          x={bounds.left + slotW * label.index + 2}
          y={bounds.bottom + 15}
          className={label.isDate ? "chart-time fill-foreground" : "chart-time"}
        >
          {label.text}
        </text>
      ))}
    </g>
  );
}
