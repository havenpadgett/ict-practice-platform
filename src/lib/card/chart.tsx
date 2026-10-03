// A static picture of a chart for generated images (share cards, link
// previews). Pure SVG with no text and no hooks, so it renders inside
// ImageResponse (Satori) as well as in the DOM. Candles follow the live
// chart (up hollow, down solid); the learner's mark is solid off-white and
// the correct answer dashed mint, the same two-style rule as the app.
// Only ever fed what the viewer is entitled to see: a link preview gets
// candles alone, a result card gets marks after the answer was committed.

import type { Candle, DealingRange } from "@/data/exercises";
import { BRAND_COLORS } from "@/lib/brand";
import { buildChartLayout, candleIndexToX, plotBounds, priceToY, regionToPixelRect, slotWidth, type ChartLayout } from "@/lib/coordinates";
import type { UserRegion } from "@/lib/grading";

const UP = "#2fb380";
const DOWN = "#e0625a";
const GRID = "#1c1f23";

export type CardZone = { price_low: number; price_high: number; candle_start: number; candle_end: number };

export type CardMarks = {
  userZone?: UserRegion | null;
  userLevel?: number | null;
  correctZone?: CardZone | null;
  correctLevel?: number | null;
  /** Choice exercises: the gap or range the question is about, drawn from the start. */
  contextZone?: CardZone | null;
  dealingRange?: DealingRange | null;
  /** Guided Entry. */
  userGuided?: { entry: number | null; stop: number | null; target: number | null } | null;
  correctGuided?: { entry: number | null; stop: number | null; target: number | null } | null;
};

function zoneRect(layout: ChartLayout, z: CardZone) {
  return regionToPixelRect(layout, { priceLow: z.price_low, priceHigh: z.price_high, candleIndexLow: z.candle_start, candleIndexHigh: z.candle_end });
}

/** Every price the marks need on the axis, so none is clipped. */
function markPrices(m: CardMarks): number[] {
  const out: number[] = [];
  if (m.userZone) out.push(m.userZone.priceLow, m.userZone.priceHigh);
  if (m.userLevel != null) out.push(m.userLevel);
  if (m.correctZone) out.push(m.correctZone.price_low, m.correctZone.price_high);
  if (m.correctLevel != null) out.push(m.correctLevel);
  if (m.contextZone) out.push(m.contextZone.price_low, m.contextZone.price_high);
  if (m.dealingRange) out.push(m.dealingRange.high, m.dealingRange.low);
  for (const g of [m.userGuided, m.correctGuided]) {
    if (g) for (const p of [g.entry, g.stop, g.target]) if (p != null) out.push(p);
  }
  return out;
}

export function ChartSvg({ candles, width, height, marks = {} }: { candles: Candle[]; width: number; height: number; marks?: CardMarks }) {
  const base = buildChartLayout(candles, width, height, { extraPrices: markPrices(marks), marginRatio: 0.1 });
  // No price axis on a card, so the plot can use the full width.
  const layout: ChartLayout = { ...base, paddingLeft: 6, paddingRight: 6, paddingTop: 10, paddingBottom: 10 };
  const b = plotBounds(layout);
  const w = slotWidth(layout);
  const bodyW = Math.max(2, w * 0.62);
  const line = (price: number, color: string, dash: string | undefined, key: string, widthPx = 2) => (
    <line key={key} x1={b.left} x2={b.right} y1={priceToY(layout, price)} y2={priceToY(layout, price)} stroke={color} strokeWidth={widthPx} strokeDasharray={dash} />
  );

  const elements = [];

  // Context first (under everything): a choice exercise's gap or range.
  if (marks.contextZone) {
    const r = zoneRect(layout, marks.contextZone);
    elements.push(<rect key="ctx" x={r.left} y={r.top} width={r.right - r.left} height={r.bottom - r.top} fill={BRAND_COLORS.muted} fillOpacity={0.16} stroke={BRAND_COLORS.muted} strokeWidth={1} />);
  }
  if (marks.dealingRange) {
    elements.push(line(marks.dealingRange.high, BRAND_COLORS.muted, "6 5", "dr-high", 1.5), line(marks.dealingRange.low, BRAND_COLORS.muted, "6 5", "dr-low", 1.5));
  }

  // Faint grid.
  for (let i = 1; i < 5; i++) {
    const y = b.top + ((b.bottom - b.top) * i) / 5;
    elements.push(<line key={`g${i}`} x1={b.left} x2={b.right} y1={y} y2={y} stroke={GRID} strokeWidth={1} />);
  }

  candles.forEach((c, i) => {
    const x = candleIndexToX(layout, i);
    const up = c.close >= c.open;
    const top = priceToY(layout, Math.max(c.open, c.close));
    const bottom = priceToY(layout, Math.min(c.open, c.close));
    elements.push(
      <line key={`w${i}`} x1={x} x2={x} y1={priceToY(layout, c.high)} y2={priceToY(layout, c.low)} stroke={up ? UP : DOWN} strokeWidth={1.4} />,
      <rect
        key={`b${i}`}
        x={x - bodyW / 2}
        y={top}
        width={bodyW}
        height={Math.max(1.5, bottom - top)}
        fill={up ? BRAND_COLORS.background : DOWN}
        stroke={up ? UP : DOWN}
        strokeWidth={1.4}
      />,
    );
  });

  // The correct answer (dashed mint) under the learner's (solid off-white).
  if (marks.correctZone) {
    const r = zoneRect(layout, marks.correctZone);
    elements.push(<rect key="cz" x={r.left} y={r.top} width={r.right - r.left} height={r.bottom - r.top} fill={BRAND_COLORS.accent} fillOpacity={0.14} stroke={BRAND_COLORS.accent} strokeWidth={2.5} strokeDasharray="7 5" />);
  }
  if (marks.correctLevel != null) elements.push(line(marks.correctLevel, BRAND_COLORS.accent, "9 6", "cl", 2.5));
  if (marks.correctGuided) {
    for (const [k, p] of Object.entries(marks.correctGuided)) if (p != null) elements.push(line(p, BRAND_COLORS.accent, "9 6", `cg-${k}`, 2.5));
  }
  if (marks.userZone) {
    const r = regionToPixelRect(layout, marks.userZone);
    elements.push(<rect key="uz" x={r.left} y={r.top} width={r.right - r.left} height={r.bottom - r.top} fill={BRAND_COLORS.foreground} fillOpacity={0.1} stroke={BRAND_COLORS.foreground} strokeWidth={2.5} />);
  }
  if (marks.userLevel != null) elements.push(line(marks.userLevel, BRAND_COLORS.foreground, undefined, "ul", 2.5));
  if (marks.userGuided) {
    for (const [k, p] of Object.entries(marks.userGuided)) if (p != null) elements.push(line(p, BRAND_COLORS.foreground, undefined, `ug-${k}`, 2.5));
  }

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} xmlns="http://www.w3.org/2000/svg">
      {elements}
    </svg>
  );
}
