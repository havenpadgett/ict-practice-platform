import type { ReviewChart } from "@/app/mistakes/actions";
import { buildChartLayout, candleIndexToX, plotBounds, priceToY, slotWidth } from "@/lib/coordinates";

const W = 240;
const H = 132;

/** A small static picture of a reviewed answer: candles, the user's answer
 * solid and the correct answer dashed (the same code as the full chart),
 * no axes. Decorative next to the text that says the same thing. */
export function ChartThumbnail({ chart }: { chart: ReviewChart }) {
  const extraPrices: number[] = [];
  if (chart.kind === "level") {
    if (chart.user !== null) extraPrices.push(chart.user);
    if (chart.correct !== null) extraPrices.push(chart.correct);
  } else if (chart.kind === "zone" && chart.user) {
    extraPrices.push(chart.user.low, chart.user.high);
  } else if (chart.kind === "guided" || chart.kind === "free") {
    for (const p of [chart.user.entry, chart.user.stop, chart.user.target]) if (p !== null) extraPrices.push(p);
  }
  const layout = buildChartLayout(chart.candles, W, H, { extraPrices, marginRatio: 0.06 });
  // No axis gutter: the thumbnail uses the full width.
  const tight = { ...layout, paddingRight: 6, paddingLeft: 6, paddingTop: 6, paddingBottom: 6 };
  const b = plotBounds(tight);
  const w = slotWidth(tight);
  const y = (p: number) => priceToY(tight, p);
  const x = (i: number) => candleIndexToX(tight, i);

  const hline = (p: number, dashed: boolean, key: string) => (
    <line
      key={key}
      x1={b.left}
      x2={b.right}
      y1={y(p)}
      y2={y(p)}
      className={dashed ? "stroke-accent" : "stroke-foreground"}
      strokeWidth={1.25}
      strokeDasharray={dashed ? "4 3" : undefined}
    />
  );

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" aria-hidden>
      {chart.candles.map((c, i) => {
        const cx = b.left + w * i + w / 2;
        const up = c.close >= c.open;
        const top = y(Math.max(c.open, c.close));
        const bot = y(Math.min(c.open, c.close));
        const bw = Math.max(1, w * 0.6);
        return (
          <g key={i}>
            <line x1={cx} x2={cx} y1={y(c.high)} y2={y(c.low)} className={up ? "stroke-candle-up" : "stroke-candle-down"} strokeWidth={0.75} />
            <rect
              x={cx - bw / 2}
              y={top}
              width={bw}
              height={Math.max(0.75, bot - top)}
              className={up ? "fill-surface stroke-candle-up" : "fill-candle-down"}
              strokeWidth={up ? 0.75 : undefined}
            />
          </g>
        );
      })}

      {chart.kind === "zone" && chart.user && (
        <rect
          x={x(Math.min(chart.user.start, chart.user.end)) - w / 2}
          y={y(chart.user.high)}
          width={w * (Math.abs(chart.user.end - chart.user.start) + 1)}
          height={Math.max(1, y(chart.user.low) - y(chart.user.high))}
          className="fill-foreground/10 stroke-foreground"
          strokeWidth={1.25}
        />
      )}
      {chart.kind === "zone" && chart.correct && (
        <rect
          x={x(chart.correct.candle_start) - w / 2}
          y={y(chart.correct.price_high)}
          width={w * (chart.correct.candle_end - chart.correct.candle_start + 1)}
          height={Math.max(1, y(chart.correct.price_low) - y(chart.correct.price_high))}
          className="fill-accent/15 stroke-accent"
          strokeWidth={1.25}
          strokeDasharray="4 3"
        />
      )}
      {chart.kind === "level" && chart.user !== null && hline(chart.user, false, "u")}
      {chart.kind === "level" && chart.correct !== null && hline(chart.correct, true, "c")}
      {chart.kind === "choice" && chart.fvgZone && (
        <rect
          x={x(chart.fvgZone.candle_start) - w / 2}
          y={y(chart.fvgZone.price_high)}
          width={b.right - (x(chart.fvgZone.candle_start) - w / 2)}
          height={Math.max(1, y(chart.fvgZone.price_low) - y(chart.fvgZone.price_high))}
          className="fill-muted/15 stroke-muted"
          strokeWidth={1}
        />
      )}
      {chart.kind === "choice" && chart.dealingRange && (
        <>
          {hline(chart.dealingRange.high, false, "rh")}
          {hline(chart.dealingRange.low, false, "rl")}
        </>
      )}
      {chart.kind === "guided" && (
        <>
          {(["entry", "stop", "target"] as const).map((f) => (chart.correct[f] !== null ? hline(chart.correct[f]!, true, `c-${f}`) : null))}
          {(["entry", "stop", "target"] as const).map((f) => (chart.user[f] !== null ? hline(chart.user[f]!, false, `u-${f}`) : null))}
        </>
      )}
      {chart.kind === "free" && (
        <>
          {chart.ideal.target !== null && hline(chart.ideal.target, true, "it")}
          {(["entry", "stop", "target"] as const).map((f) => (chart.user[f] !== null ? hline(chart.user[f]!, false, `u-${f}`) : null))}
        </>
      )}
    </svg>
  );
}
