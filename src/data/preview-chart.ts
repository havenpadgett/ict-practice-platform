// A hand-built chart for the landing page's product preview only. It's
// not an exercise and never appears in practice, so showing its answer on
// a public page gives nothing away. A clean bullish Fair Value Gap: candle
// 13's high sits below candle 15's low, across the displacement candle.

import type { Candle } from "@/data/exercises";

export const PREVIEW_CANDLES: Candle[] = [
  { time: "09:30", open: 21112.0, high: 21113.5, low: 21105.25, close: 21108.25 },
  { time: "09:35", open: 21108.25, high: 21110.75, low: 21099.75, close: 21102.0 },
  { time: "09:40", open: 21102.0, high: 21104.5, low: 21094.5, close: 21095.5 },
  { time: "09:45", open: 21095.5, high: 21096.75, low: 21091.5, close: 21093.0 },
  { time: "09:50", open: 21093.0, high: 21096.25, low: 21088.75, close: 21090.0 },
  { time: "09:55", open: 21090.0, high: 21093.0, low: 21081.5, close: 21085.25 },
  { time: "10:00", open: 21085.25, high: 21087.5, low: 21080.25, close: 21084.25 },
  { time: "10:05", open: 21084.25, high: 21087.75, low: 21075.75, close: 21077.5 },
  { time: "10:10", open: 21077.5, high: 21079.0, low: 21070.0, close: 21072.0 },
  { time: "10:15", open: 21072.0, high: 21074.75, low: 21069.25, close: 21073.25 },
  { time: "10:20", open: 21073.25, high: 21075.25, low: 21070.0, close: 21072.5 },
  { time: "10:25", open: 21072.5, high: 21073.75, low: 21064.5, close: 21066.25 },
  { time: "10:30", open: 21066.25, high: 21068.75, low: 21061.25, close: 21063.25 },
  { time: "10:35", open: 21063.25, high: 21101.25, low: 21061.75, close: 21098.25 },
  { time: "10:40", open: 21098.25, high: 21112.25, low: 21081.75, close: 21109.25 },
  { time: "10:45", open: 21109.25, high: 21115.5, low: 21107.25, close: 21113.25 },
  { time: "10:50", open: 21113.25, high: 21119.0, low: 21111.5, close: 21116.5 },
  { time: "10:55", open: 21116.5, high: 21124.75, low: 21115.0, close: 21121.75 },
  { time: "11:00", open: 21121.75, high: 21127.5, low: 21118.25, close: 21125.0 },
  { time: "11:05", open: 21125.0, high: 21131.25, low: 21121.0, close: 21129.5 },
  { time: "11:10", open: 21129.5, high: 21131.75, low: 21125.25, close: 21128.5 },
  { time: "11:15", open: 21128.5, high: 21131.0, low: 21126.75, close: 21128.0 },
  { time: "11:20", open: 21128.0, high: 21135.25, low: 21125.25, close: 21132.0 },
  { time: "11:25", open: 21132.0, high: 21136.5, low: 21128.75, close: 21134.5 },
  { time: "11:30", open: 21134.5, high: 21137.5, low: 21132.25, close: 21134.75 },
  { time: "11:35", open: 21134.75, high: 21141.0, low: 21132.25, close: 21137.25 },
  { time: "11:40", open: 21137.25, high: 21139.0, low: 21134.0, close: 21138.0 },
  { time: "11:45", open: 21138.0, high: 21142.5, low: 21134.5, close: 21138.5 },
  { time: "11:50", open: 21138.5, high: 21140.75, low: 21133.0, close: 21136.0 },
  { time: "11:55", open: 21136.0, high: 21138.25, low: 21129.5, close: 21131.0 },
  { time: "12:00", open: 21131.0, high: 21132.0, low: 21123.5, close: 21126.75 },
  { time: "12:05", open: 21126.75, high: 21128.5, low: 21120.5, close: 21122.75 },
];

/** The gap: candle index 12's high to candle index 14's low. */
export const PREVIEW_GAP = { price_low: 21068.75, price_high: 21081.75, candle_start: 12, candle_end: 14 };

/** A plausible learner's box: right candles, drawn too tall. */
export const PREVIEW_USER_BOX = { priceLow: 21062, priceHigh: 21099, candleIndexLow: 12, candleIndexHigh: 14 };
