// Candles for the scenario engine, and the one place a higher timeframe is
// ever made: by resampling the same finest-resolution series. Nothing here
// invents multi-timeframe context. A timeframe is offered only when the
// scenario's data holds enough real (or, for seeded scenarios, consistently
// generated) bars to draw it, and a coarse candle is always built from the
// finer ones, so the same moment looks the same on every chart.

import type { Candle } from "@/data/exercises";
import { bucketStart, formatClock, TIMEFRAME_MINUTES, TIMEFRAMES, toEtTimestamp, type Timeframe } from "@/lib/engine/time";

export type SimCandle = {
  /** Open time, ET minutes (src/lib/engine/time.ts). */
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
};

/** Compact storage form: [t, o, h, l, c]. */
export type CandleRow = [number, number, number, number, number];

export const toRow = (c: SimCandle): CandleRow => [c.t, c.o, c.h, c.l, c.c];
export const fromRow = (r: CandleRow): SimCandle => ({ t: r[0], o: r[1], h: r[2], l: r[3], c: r[4] });

/** Resamples ascending finer candles into `tf` buckets. The last bucket may
 * be partial: that is the candle still forming at the replay cursor, built
 * only from candles that have already happened. */
export function resample(candles: readonly SimCandle[], tf: Timeframe): SimCandle[] {
  const out: SimCandle[] = [];
  let current: SimCandle | null = null;
  for (const k of candles) {
    const start = bucketStart(k.t, tf);
    if (current && current.t === start) {
      if (k.h > current.h) current.h = k.h;
      if (k.l < current.l) current.l = k.l;
      current.c = k.c;
    } else {
      current = { t: start, o: k.o, h: k.h, l: k.l, c: k.c };
      out.push(current);
    }
  }
  return out;
}

/** Fewest bars a timeframe needs before it is worth showing: a Daily chart
 * with three candles is not Daily context. */
export const MIN_BARS: Record<Timeframe, number> = { "1D": 8, "4H": 12, "1H": 12, "15m": 16, "5m": 16, "1m": 20 };

export type TimeframeData = {
  /** Complete candles before the stream's first candle, per timeframe. */
  history: Partial<Record<Timeframe, SimCandle[]>>;
  /** Finest-resolution candles from the stream anchor onward. */
  stream: SimCandle[];
  streamTimeframe: Timeframe;
};

/** The candles `tf` shows when `revealed` stream candles exist: stored
 * history plus the stream resampled up to the cursor. Only past candles
 * contribute, so nothing about the future leaks into a forming bar. */
export function seriesAt(data: TimeframeData, tf: Timeframe, revealed: number): SimCandle[] {
  const known = data.stream.slice(0, revealed);
  const history = data.history[tf] ?? [];
  if (TIMEFRAME_MINUTES[tf] <= TIMEFRAME_MINUTES[data.streamTimeframe]) return tf === data.streamTimeframe ? [...history, ...known] : [];
  const live = resample(known, tf);
  // The stream anchor is a Daily boundary, so no bucket spans the seam; the
  // guard keeps a hand-built scenario with a misaligned seam from drawing
  // the same bucket twice.
  const lastHistory = history[history.length - 1];
  const fresh = lastHistory ? live.filter((c) => c.t > lastHistory.t) : live;
  return [...history, ...fresh];
}

/** The timeframes this scenario can honestly offer at `revealed`. */
export function supportedTimeframes(data: TimeframeData, revealed: number): Timeframe[] {
  return TIMEFRAMES.filter((tf) => {
    if (TIMEFRAME_MINUTES[tf] < TIMEFRAME_MINUTES[data.streamTimeframe]) return false;
    return seriesAt(data, tf, revealed).length >= MIN_BARS[tf];
  });
}

/** Adapts engine candles to the chart components, which read `Candle`
 * (src/data/exercises.ts) with an ET timestamp for the time layer. */
export function toChartCandles(candles: readonly SimCandle[]): Candle[] {
  return candles.map((c) => ({
    time: formatClock(c.t),
    timestamp: toEtTimestamp(c.t),
    open: c.o,
    high: c.h,
    low: c.l,
    close: c.c,
  }));
}

/** Index of the candle containing `t` (or the nearest earlier one), -1 if
 * `t` precedes the series. For placing a time-anchored mark on whichever
 * timeframe is showing. */
export function indexAtTime(candles: readonly SimCandle[], t: number): number {
  let lo = 0;
  let hi = candles.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (candles[mid].t <= t) {
      found = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return found;
}

/** Highest high and lowest low of a series. */
export function priceRange(candles: readonly SimCandle[]): { high: number; low: number } {
  let high = -Infinity;
  let low = Infinity;
  for (const c of candles) {
    if (c.h > high) high = c.h;
    if (c.l < low) low = c.l;
  }
  return { high, low };
}
