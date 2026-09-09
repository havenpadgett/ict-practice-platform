import type { Candle } from "@/data/exercises";

/**
 * Everything a chart render needs to convert between "domain" units (price,
 * candle index) and "pixel" units (x/y inside the SVG's own coordinate
 * space). Building this once per render and threading it through every
 * conversion means the two directions can never drift out of sync with
 * each other.
 */
export type ChartLayout = {
  width: number;
  height: number;
  paddingTop: number;
  paddingRight: number;
  paddingBottom: number;
  paddingLeft: number;
  priceMin: number;
  priceMax: number;
  candleCount: number;
};

const PADDING = { top: 16, right: 64, bottom: 24, left: 8 };
/** Extra breathing room above/below the candle range so wicks don't touch the edges. */
const PRICE_MARGIN_RATIO = 0.08;

export function buildChartLayout(
  candles: Candle[],
  width: number,
  height: number,
): ChartLayout {
  const highs = candles.map((c) => c.high);
  const lows = candles.map((c) => c.low);
  const rawMax = Math.max(...highs);
  const rawMin = Math.min(...lows);
  const margin = (rawMax - rawMin) * PRICE_MARGIN_RATIO;

  return {
    width,
    height,
    paddingTop: PADDING.top,
    paddingRight: PADDING.right,
    paddingBottom: PADDING.bottom,
    paddingLeft: PADDING.left,
    priceMin: rawMin - margin,
    priceMax: rawMax + margin,
    candleCount: candles.length,
  };
}

export function plotBounds(layout: ChartLayout) {
  return {
    left: layout.paddingLeft,
    right: layout.width - layout.paddingRight,
    top: layout.paddingTop,
    bottom: layout.height - layout.paddingBottom,
  };
}

// ---- Price <-> Y pixel -----------------------------------------------
//
// SVG's y-axis grows downward, but price grows upward, so this is an
// inverted linear interpolation: priceMax maps to the top of the plot area
// and priceMin maps to the bottom.

export function priceToY(layout: ChartLayout, price: number): number {
  const { top, bottom } = plotBounds(layout);
  const t = (price - layout.priceMin) / (layout.priceMax - layout.priceMin);
  return bottom - t * (bottom - top);
}

export function yToPrice(layout: ChartLayout, y: number): number {
  const { top, bottom } = plotBounds(layout);
  const t = (bottom - y) / (bottom - top);
  return layout.priceMin + t * (layout.priceMax - layout.priceMin);
}

// ---- Candle index <-> X pixel ------------------------------------------
//
// The plot area is sliced into `candleCount` equal-width slots. A candle's
// x position is the center of its slot; converting a pixel back to an index
// is the same division run in reverse, then clamped to a valid index.

export function slotWidth(layout: ChartLayout): number {
  const { left, right } = plotBounds(layout);
  return (right - left) / layout.candleCount;
}

export function candleIndexToX(layout: ChartLayout, index: number): number {
  const { left } = plotBounds(layout);
  const w = slotWidth(layout);
  return left + w * index + w / 2;
}

export function xToCandleIndex(layout: ChartLayout, x: number): number {
  const { left } = plotBounds(layout);
  const w = slotWidth(layout);
  const index = Math.floor((x - left) / w);
  return Math.min(Math.max(index, 0), layout.candleCount - 1);
}

/** Converts a domain region (price range + candle-index range) back into a
 * pixel rectangle, so the same region type can be rendered as an overlay
 * regardless of whether it's the live drag box, the user's frozen answer,
 * or the true FVG zone. */
export function regionToPixelRect(
  layout: ChartLayout,
  region: {
    priceLow: number;
    priceHigh: number;
    candleIndexLow: number;
    candleIndexHigh: number;
  },
) {
  const w = slotWidth(layout);
  return {
    left: candleIndexToX(layout, region.candleIndexLow) - w / 2,
    right: candleIndexToX(layout, region.candleIndexHigh) + w / 2,
    top: priceToY(layout, region.priceHigh),
    bottom: priceToY(layout, region.priceLow),
  };
}

export function clampToPlot(
  layout: ChartLayout,
  x: number,
  y: number,
): { x: number; y: number } {
  const { left, right, top, bottom } = plotBounds(layout);
  return {
    x: Math.min(Math.max(x, left), right),
    y: Math.min(Math.max(y, top), bottom),
  };
}
