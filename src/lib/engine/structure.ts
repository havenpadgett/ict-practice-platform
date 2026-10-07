// Small structure detectors over engine candles: swing points, fair value
// gaps, displacement. They exist so reference answers can be derived from the
// data by code rather than typed in (the project's rule for answer keys), and
// so a test can prove a scenario's reference markings sit on real structure.
// They are deliberately plain; the curriculum's real-data rules live in
// scripts/detect.py and are not duplicated here.

import type { SimCandle } from "@/lib/engine/candles";
import { TIMEFRAME_MINUTES, type Timeframe } from "@/lib/engine/time";

export type Swing = { index: number; t: number; price: number; kind: "high" | "low" };

/** Fractal swings: a high above `lookback` candles either side (a low below). */
export function swings(candles: readonly SimCandle[], lookback = 2): Swing[] {
  const out: Swing[] = [];
  for (let i = lookback; i < candles.length - lookback; i++) {
    let isHigh = true;
    let isLow = true;
    for (let j = 1; j <= lookback; j++) {
      if (candles[i].h <= candles[i - j].h || candles[i].h <= candles[i + j].h) isHigh = false;
      if (candles[i].l >= candles[i - j].l || candles[i].l >= candles[i + j].l) isLow = false;
    }
    if (isHigh) out.push({ index: i, t: candles[i].t, price: candles[i].h, kind: "high" });
    if (isLow) out.push({ index: i, t: candles[i].t, price: candles[i].l, kind: "low" });
  }
  return out;
}

export type Fvg = {
  /** Index of the middle (expansion) candle. */
  index: number;
  direction: "bullish" | "bearish";
  low: number;
  high: number;
  tStart: number;
  tEnd: number;
};

/** Three-candle fair value gaps: candle 1's high below candle 3's low
 * (bullish) or candle 1's low above candle 3's high (bearish). */
export function fvgs(candles: readonly SimCandle[], tf: Timeframe, minSize = 0): Fvg[] {
  const out: Fvg[] = [];
  const span = TIMEFRAME_MINUTES[tf];
  for (let i = 1; i < candles.length - 1; i++) {
    const a = candles[i - 1];
    const c = candles[i + 1];
    if (c.l - a.h > minSize) out.push({ index: i, direction: "bullish", low: a.h, high: c.l, tStart: a.t, tEnd: c.t + span - 1 });
    else if (a.l - c.h > minSize) out.push({ index: i, direction: "bearish", low: c.h, high: a.l, tStart: a.t, tEnd: c.t + span - 1 });
  }
  return out;
}

/** Average true range over the series (or the last `n` candles). */
export function atr(candles: readonly SimCandle[], n = 14): number {
  const tail = candles.slice(-n);
  if (tail.length === 0) return 0;
  return tail.reduce((s, c) => s + (c.h - c.l), 0) / tail.length;
}

/** Whether a candle's body is at least `mult` times the average range of the
 * candles before it: a plain test for displacement. */
export function isDisplacement(candles: readonly SimCandle[], index: number, mult = 1.8): boolean {
  if (index < 3) return false;
  const body = Math.abs(candles[index].c - candles[index].o);
  return body >= atr(candles.slice(Math.max(0, index - 20), index), 20) * mult;
}
