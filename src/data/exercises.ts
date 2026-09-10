// Exercise data shape follows PRD-MVP-V1.md Section 5, generalized in
// Phase 4 to cover more than one concept. Field names are kept snake_case
// to match the PRD's Exercise definition so the data contract is easy to
// cross-reference with the doc.

import type { Concept } from "@/lib/concepts";

export type Candle = {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
};

export type ZoneAnswer = {
  /** Direction label — meaning depends on concept: "bullish" | "bearish"
   * for FVG, "buy_side" | "sell_side" for Liquidity. Descriptive only;
   * grading never branches on it. */
  type: string;
  /** Bottom of the zone's price range. */
  price_low: number;
  /** Top of the zone's price range. */
  price_high: number;
  /** Index of the first candle that defines the zone. */
  candle_start: number;
  /** Index of the last candle that defines the zone. */
  candle_end: number;
  /** The candle the user's box must horizontally include to pass the time
   * test. For FVG this is always candle_start + 1 (the middle candle of
   * the three-candle formation); for Liquidity it's the candle that
   * confirms the second touch of the level. Stored explicitly rather than
   * assumed, since not every concept's zone has the same shape. */
  key_candle_index: number;
};

export type Exercise = {
  exercise_id: string;
  concept: Concept;
  /** Prototype data, labeled as such — not real market data. */
  instrument: string;
  timeframe: string;
  difficulty: 1 | 2 | 3;
  candles: Candle[];
  /** Prompt shown above the chart, e.g. "Mark the Fair Value Gap." */
  prompt: string;
  has_zone: boolean;
  /** null when has_zone is false. */
  answer: ZoneAnswer | null;
  explanation: string;
  /** Required when has_zone is false. */
  distractor_note?: string;
};

// fvg-001: a single bullish FVG sits at candles[19..21]. Candle 19's high
// (21107.25) is below candle 21's low (21139.25) — candle 20 is the large
// expansion candle that leaves that range unfilled. Every other 3-candle
// window in this series was checked by generation script and does not
// qualify as a gap (bullish or bearish), per the PRD's ambiguity rule
// (exactly one valid FVG, never two).
export const exercises: Exercise[] = [
  {
    exercise_id: "fvg-001",
    concept: "FVG",
    prompt: "Mark the Fair Value Gap.",
    instrument: "NQ (prototype data)",
    timeframe: "5m",
    difficulty: 1,
    has_zone: true,
    answer: {
      type: "bullish",
      price_low: 21107.25,
      price_high: 21139.25,
      candle_start: 19,
      candle_end: 21,
      key_candle_index: 20,
    },
    explanation:
      "Candle 1's high (21,107.25) sits below candle 3's low (21,139.25), leaving an unfilled imbalance across candle 2 that price has not traded back through.",
    candles: [
      { time: "09:30", open: 21050, high: 21068.5, low: 21041.25, close: 21060.75 },
      { time: "09:35", open: 21060.75, high: 21074.25, low: 21053.75, close: 21068.25 },
      { time: "09:40", open: 21068.25, high: 21073.25, low: 21061.25, close: 21071 },
      { time: "09:45", open: 21071, high: 21085.75, low: 21066.75, close: 21078.75 },
      { time: "09:50", open: 21078.75, high: 21094.25, low: 21069.75, close: 21085.5 },
      { time: "09:55", open: 21085.5, high: 21099.75, low: 21082.5, close: 21096.5 },
      { time: "10:00", open: 21096.5, high: 21108.75, low: 21093.25, close: 21100.75 },
      { time: "10:05", open: 21100.75, high: 21105, low: 21093.75, close: 21099 },
      { time: "10:10", open: 21099, high: 21106, low: 21093.25, close: 21103.75 },
      { time: "10:15", open: 21103.75, high: 21116, low: 21096.5, close: 21111 },
      { time: "10:20", open: 21111, high: 21119.25, low: 21095, close: 21100.5 },
      { time: "10:25", open: 21100.5, high: 21108.75, low: 21088.25, close: 21091.5 },
      { time: "10:30", open: 21091.5, high: 21098.75, low: 21083, close: 21087 },
      { time: "10:35", open: 21087, high: 21095.75, low: 21070.5, close: 21073.75 },
      { time: "10:40", open: 21073.75, high: 21087, low: 21069.5, close: 21078.25 },
      { time: "10:45", open: 21078.25, high: 21085, low: 21075.75, close: 21082.5 },
      { time: "10:50", open: 21082.5, high: 21090, low: 21072, close: 21080.25 },
      { time: "10:55", open: 21080.25, high: 21087.25, low: 21073.75, close: 21076.75 },
      { time: "11:00", open: 21076.75, high: 21102.25, low: 21072.5, close: 21089.25 },
      // Candle 19 — candle 1 of the FVG formation
      { time: "11:05", open: 21089.25, high: 21107.25, low: 21086.25, close: 21103.25 },
      // Candle 20 — the expansion candle that creates the imbalance
      { time: "11:10", open: 21103.25, high: 21170.25, low: 21101.25, close: 21165.25 },
      // Candle 21 — candle 3, confirms the gap (low stays above candle 19's high)
      { time: "11:15", open: 21159.25, high: 21182.25, low: 21139.25, close: 21177.25 },
      { time: "11:20", open: 21177.25, high: 21184.25, low: 21169.75, close: 21178.25 },
      { time: "11:25", open: 21178.25, high: 21187.5, low: 21169.25, close: 21180.25 },
      { time: "11:30", open: 21180.25, high: 21186.75, low: 21175, close: 21179.25 },
      { time: "11:35", open: 21179.25, high: 21189, low: 21176, close: 21183 },
      { time: "11:40", open: 21183, high: 21185, low: 21180.5, close: 21182.75 },
      { time: "11:45", open: 21182.75, high: 21187.5, low: 21177.75, close: 21181.75 },
      { time: "11:50", open: 21181.75, high: 21197, low: 21177.5, close: 21194.5 },
      { time: "11:55", open: 21194.5, high: 21200, low: 21185.5, close: 21191.5 },
      { time: "12:00", open: 21191.5, high: 21194.25, low: 21177.5, close: 21182.75 },
      { time: "12:05", open: 21182.75, high: 21194, low: 21177.75, close: 21190 },
      { time: "12:10", open: 21190, high: 21196, low: 21182, close: 21190.75 },
      { time: "12:15", open: 21190.75, high: 21204.25, low: 21187.75, close: 21202 },
      { time: "12:20", open: 21202, high: 21207.25, low: 21189, close: 21196.25 },
      { time: "12:25", open: 21196.25, high: 21199.25, low: 21183.5, close: 21186 },
      { time: "12:30", open: 21186, high: 21200.75, low: 21180.25, close: 21195.25 },
      { time: "12:35", open: 21195.25, high: 21212.25, low: 21189.25, close: 21204 },
      { time: "12:40", open: 21204, high: 21211.75, low: 21197.5, close: 21203.25 },
      { time: "12:45", open: 21203.25, high: 21209.75, low: 21187.75, close: 21196.25 },
    ],
  },
  // fvg-002: a second bullish FVG, different price story and location
  // (candles[12..14], mid-uptrend breakout) than fvg-001. Verified: exactly
  // one qualifying gap in the whole series.
  {
    exercise_id: "fvg-002",
    concept: "FVG",
    prompt: "Mark the Fair Value Gap.",
    instrument: "NQ (prototype data)",
    timeframe: "5m",
    difficulty: 1,
    has_zone: true,
    answer: {
      type: "bullish",
      price_low: 21443,
      price_high: 21481,
      candle_start: 12,
      candle_end: 14,
      key_candle_index: 13,
    },
    explanation:
      "Candle 1's high (21,443.00) sits below candle 3's low (21,481.00), leaving an unfilled imbalance across candle 2 that price has not traded back through.",
    candles: [
      { time: "09:30", open: 21400, high: 21402.75, low: 21386.25, close: 21393.75 },
      { time: "09:35", open: 21393.75, high: 21398, low: 21388, close: 21392.75 },
      { time: "09:40", open: 21392.75, high: 21407.75, low: 21390.25, close: 21400.25 },
      { time: "09:45", open: 21400.25, high: 21408.25, low: 21396.75, close: 21405.5 },
      { time: "09:50", open: 21405.5, high: 21412.75, low: 21401.75, close: 21407.75 },
      { time: "09:55", open: 21407.75, high: 21420.5, low: 21401.75, close: 21416.5 },
      { time: "10:00", open: 21416.5, high: 21429.5, low: 21409.75, close: 21426.75 },
      { time: "10:05", open: 21426.75, high: 21430.5, low: 21417.25, close: 21420 },
      { time: "10:10", open: 21420, high: 21423.25, low: 21403.5, close: 21411.25 },
      { time: "10:15", open: 21411.25, high: 21427.75, low: 21407.75, close: 21420.75 },
      { time: "10:20", open: 21420.75, high: 21428, low: 21415, close: 21421.5 },
      { time: "10:25", open: 21421.5, high: 21438, low: 21415.5, close: 21431 },
      // Candle 12 — candle 1 of the FVG formation
      { time: "10:30", open: 21431, high: 21443, low: 21427, close: 21440 },
      // Candle 13 — the expansion candle
      { time: "10:35", open: 21440, high: 21515, low: 21437, close: 21511 },
      // Candle 14 — candle 3, confirms the gap
      { time: "10:40", open: 21503, high: 21530, low: 21481, close: 21526 },
      { time: "10:45", open: 21526, high: 21533.25, low: 21511.25, close: 21515.5 },
      { time: "10:50", open: 21515.5, high: 21522.5, low: 21512.5, close: 21515.25 },
      { time: "10:55", open: 21515.25, high: 21521.75, low: 21510.5, close: 21516.5 },
      { time: "11:00", open: 21516.5, high: 21525.5, low: 21509.5, close: 21520.5 },
      { time: "11:05", open: 21520.5, high: 21522.75, low: 21509, close: 21514.5 },
      { time: "11:10", open: 21514.5, high: 21525.5, low: 21511.5, close: 21519.75 },
      { time: "11:15", open: 21519.75, high: 21525.25, low: 21517.75, close: 21519.75 },
      { time: "11:20", open: 21519.75, high: 21536.5, low: 21514.75, close: 21531.75 },
      { time: "11:25", open: 21531.75, high: 21534, low: 21523, close: 21530 },
      { time: "11:30", open: 21530, high: 21538.5, low: 21524.25, close: 21533 },
      { time: "11:35", open: 21533, high: 21546, low: 21528.25, close: 21542 },
      { time: "11:40", open: 21542, high: 21550.5, low: 21535.75, close: 21544.5 },
      { time: "11:45", open: 21544.5, high: 21546.75, low: 21531.25, close: 21537.75 },
      { time: "11:50", open: 21537.75, high: 21544.75, low: 21526.5, close: 21529 },
      { time: "11:55", open: 21529, high: 21540.5, low: 21526.75, close: 21535.25 },
      { time: "12:00", open: 21535.25, high: 21540.75, low: 21532.75, close: 21536 },
      { time: "12:05", open: 21536, high: 21547.25, low: 21530, close: 21544.75 },
      { time: "12:10", open: 21544.75, high: 21551.75, low: 21533.75, close: 21536.5 },
      { time: "12:15", open: 21536.5, high: 21547.25, low: 21529, close: 21544.5 },
      { time: "12:20", open: 21544.5, high: 21548.5, low: 21535.5, close: 21540.25 },
      { time: "12:25", open: 21540.25, high: 21547.75, low: 21525.75, close: 21528.75 },
      { time: "12:30", open: 21528.75, high: 21541.75, low: 21522.25, close: 21535 },
      { time: "12:35", open: 21535, high: 21545.5, low: 21530.25, close: 21538 },
      { time: "12:40", open: 21538, high: 21540.75, low: 21533, close: 21535 },
      { time: "12:45", open: 21535, high: 21541.5, low: 21526.5, close: 21533.25 },
    ],
  },
  // fvg-003: a bearish FVG (candle 1's low above candle 3's high), at
  // candles[22..24]. Verified: exactly one qualifying gap in the series.
  {
    exercise_id: "fvg-003",
    concept: "FVG",
    prompt: "Mark the Fair Value Gap.",
    instrument: "NQ (prototype data)",
    timeframe: "5m",
    difficulty: 2,
    has_zone: true,
    answer: {
      type: "bearish",
      price_low: 21546.25,
      price_high: 21582.25,
      candle_start: 22,
      candle_end: 24,
      key_candle_index: 23,
    },
    explanation:
      "Candle 1's low (21,582.25) sits above candle 3's high (21,546.25), leaving an unfilled imbalance across candle 2 that price has not traded back through.",
    candles: [
      { time: "09:30", open: 21600, high: 21605.5, low: 21591, close: 21594.25 },
      { time: "09:35", open: 21594.25, high: 21602, low: 21579.25, close: 21586.5 },
      { time: "09:40", open: 21586.5, high: 21594.5, low: 21577, close: 21580.5 },
      { time: "09:45", open: 21580.5, high: 21592.75, low: 21573.75, close: 21590 },
      { time: "09:50", open: 21590, high: 21597, low: 21582.25, close: 21591.25 },
      { time: "09:55", open: 21591.25, high: 21596.75, low: 21588.25, close: 21594 },
      { time: "10:00", open: 21594, high: 21601.5, low: 21587, close: 21594.5 },
      { time: "10:05", open: 21594.5, high: 21602.25, low: 21590.5, close: 21598.25 },
      { time: "10:10", open: 21598.25, high: 21605.75, low: 21595, close: 21597.5 },
      { time: "10:15", open: 21597.5, high: 21600, low: 21588.75, close: 21594.25 },
      { time: "10:20", open: 21594.25, high: 21603.25, low: 21591.25, close: 21600.25 },
      { time: "10:25", open: 21600.25, high: 21606.5, low: 21586, close: 21589.5 },
      { time: "10:30", open: 21589.5, high: 21596, low: 21585.75, close: 21594 },
      { time: "10:35", open: 21594, high: 21599.5, low: 21577.25, close: 21583.5 },
      { time: "10:40", open: 21583.5, high: 21592.5, low: 21576, close: 21586 },
      { time: "10:45", open: 21586, high: 21599.5, low: 21582.25, close: 21591.75 },
      { time: "10:50", open: 21591.75, high: 21606.25, low: 21588.25, close: 21600.25 },
      { time: "10:55", open: 21600.25, high: 21603.75, low: 21594.25, close: 21597.75 },
      { time: "11:00", open: 21597.75, high: 21607, low: 21591.5, close: 21604.25 },
      { time: "11:05", open: 21604.25, high: 21610.75, low: 21599.25, close: 21601.5 },
      { time: "11:10", open: 21601.5, high: 21610.25, low: 21595.75, close: 21605.5 },
      { time: "11:15", open: 21605.5, high: 21612.25, low: 21586.75, close: 21594.25 },
      // Candle 22 — candle 1 of the formation
      { time: "11:20", open: 21594.25, high: 21598.25, low: 21582.25, close: 21585.25 },
      // Candle 23 — the expansion candle (sharp drop)
      { time: "11:25", open: 21585.25, high: 21588.25, low: 21513.25, close: 21517.25 },
      // Candle 24 — candle 3, confirms the gap
      { time: "11:30", open: 21525.25, high: 21546.25, low: 21499.25, close: 21503.25 },
      { time: "11:35", open: 21503.25, high: 21514.75, low: 21499.5, close: 21512.5 },
      { time: "11:40", open: 21512.5, high: 21522.5, low: 21509.25, close: 21516.5 },
      { time: "11:45", open: 21516.5, high: 21525.75, low: 21514.25, close: 21523 },
      { time: "11:50", open: 21523, high: 21533, low: 21519.5, close: 21526 },
      { time: "11:55", open: 21526, high: 21532.25, low: 21522.5, close: 21529.25 },
      { time: "12:00", open: 21529.25, high: 21534.25, low: 21518.5, close: 21523 },
      { time: "12:05", open: 21523, high: 21535, low: 21519.75, close: 21531 },
      { time: "12:10", open: 21531, high: 21541.75, low: 21528.75, close: 21539.25 },
      { time: "12:15", open: 21539.25, high: 21553, low: 21534.75, close: 21545.75 },
      { time: "12:20", open: 21545.75, high: 21552.75, low: 21539, close: 21546.5 },
      { time: "12:25", open: 21546.5, high: 21549.5, low: 21536, close: 21543.25 },
      { time: "12:30", open: 21543.25, high: 21553.25, low: 21540.75, close: 21548 },
      { time: "12:35", open: 21548, high: 21562.75, low: 21541.25, close: 21558.5 },
      { time: "12:40", open: 21558.5, high: 21561.75, low: 21551, close: 21554.5 },
      { time: "12:45", open: 21554.5, high: 21560.75, low: 21548.75, close: 21552.25 },
    ],
  },
  // fvg-004: has_zone is false. Candles[17..19] look like a bullish FVG at a
  // glance but candle 1's high and candle 3's low overlap by 1 point, so no
  // imbalance actually exists — a deliberate near-miss. Verified: zero
  // qualifying gaps anywhere in the series.
  {
    exercise_id: "fvg-004",
    concept: "FVG",
    prompt: "Mark the Fair Value Gap.",
    instrument: "NQ (prototype data)",
    timeframe: "5m",
    difficulty: 2,
    has_zone: false,
    answer: null,
    explanation:
      "Candles 18–20 (10:55–11:05) look like a bullish FVG at first glance, but candle 18's high (21,210.25) and candle 20's low (21,209.25) overlap by 1 point — the range isn't actually unfilled, so no imbalance exists there.",
    distractor_note:
      "Candles 18–20 (10:55–11:05) look like a bullish FVG at first glance, but candle 18's high (21,210.25) and candle 20's low (21,209.25) overlap by 1 point — the range isn't actually unfilled, so no imbalance exists there.",
    candles: [
      { time: "09:30", open: 21200, high: 21208, low: 21189.5, close: 21195 },
      { time: "09:35", open: 21195, high: 21209.5, low: 21191.5, close: 21204.5 },
      { time: "09:40", open: 21204.5, high: 21211.25, low: 21200.5, close: 21209 },
      { time: "09:45", open: 21209, high: 21211.25, low: 21195, close: 21199 },
      { time: "09:50", open: 21199, high: 21206, low: 21193, close: 21199.25 },
      { time: "09:55", open: 21199.25, high: 21206.25, low: 21190.25, close: 21196.25 },
      { time: "10:00", open: 21196.25, high: 21201.5, low: 21179.75, close: 21186.75 },
      { time: "10:05", open: 21186.75, high: 21190.75, low: 21172, close: 21177.25 },
      { time: "10:10", open: 21177.25, high: 21190, low: 21173.75, close: 21184.5 },
      { time: "10:15", open: 21184.5, high: 21193.75, low: 21180.75, close: 21187 },
      { time: "10:20", open: 21187, high: 21201.25, low: 21184, close: 21197.25 },
      { time: "10:25", open: 21197.25, high: 21202.75, low: 21186.5, close: 21190 },
      { time: "10:30", open: 21190, high: 21200, low: 21188, close: 21198 },
      { time: "10:35", open: 21198, high: 21200.25, low: 21185, close: 21191.75 },
      { time: "10:40", open: 21191.75, high: 21202, low: 21189.5, close: 21199.75 },
      { time: "10:45", open: 21199.75, high: 21204.5, low: 21185.5, close: 21188.75 },
      { time: "10:50", open: 21188.75, high: 21195.25, low: 21177.5, close: 21183.25 },
      // Candle 18 — the near-miss "candle 1": high sits just above what
      // would need to be candle 3's low for a real gap.
      { time: "10:55", open: 21183.25, high: 21210.25, low: 21179.25, close: 21193.25 },
      { time: "11:00", open: 21193.25, high: 21230.25, low: 21190.25, close: 21227.25 },
      // Candle 20 — the near-miss "candle 3": low overlaps candle 18's high
      // by 1 point instead of clearing it.
      { time: "11:05", open: 21221.25, high: 21241.25, low: 21209.25, close: 21237.25 },
      { time: "11:10", open: 21237.25, high: 21243.25, low: 21224.5, close: 21232 },
      { time: "11:15", open: 21232, high: 21243.25, low: 21225.5, close: 21238.75 },
      { time: "11:20", open: 21238.75, high: 21241.25, low: 21228.25, close: 21236 },
      { time: "11:25", open: 21236, high: 21239, low: 21228.25, close: 21236.5 },
      { time: "11:30", open: 21236.5, high: 21245.75, low: 21233.25, close: 21239 },
      { time: "11:35", open: 21239, high: 21245.25, low: 21225.5, close: 21227.75 },
      { time: "11:40", open: 21227.75, high: 21237.5, low: 21223.5, close: 21231.25 },
      { time: "11:45", open: 21231.25, high: 21240.5, low: 21225.25, close: 21235 },
      { time: "11:50", open: 21235, high: 21243.5, low: 21231.5, close: 21239.75 },
      { time: "11:55", open: 21239.75, high: 21243.5, low: 21226.75, close: 21232 },
      { time: "12:00", open: 21232, high: 21240, low: 21224, close: 21232.25 },
      { time: "12:05", open: 21232.25, high: 21238.25, low: 21215.5, close: 21223.25 },
      { time: "12:10", open: 21223.25, high: 21230.5, low: 21214, close: 21221.5 },
      { time: "12:15", open: 21221.5, high: 21232, low: 21217.75, close: 21229.75 },
      { time: "12:20", open: 21229.75, high: 21241.5, low: 21225, close: 21236.5 },
      { time: "12:25", open: 21236.5, high: 21246.75, low: 21229.75, close: 21240.5 },
      { time: "12:30", open: 21240.5, high: 21252.75, low: 21233.5, close: 21250.25 },
      { time: "12:35", open: 21250.25, high: 21262.5, low: 21243, close: 21260.5 },
      { time: "12:40", open: 21260.5, high: 21268.5, low: 21247.25, close: 21251.75 },
      { time: "12:45", open: 21251.75, high: 21266.75, low: 21244.75, close: 21262.5 },
    ],
  },
  // fvg-005: bullish, harder — a smaller gap (13 points vs fvg-001's 32)
  // inside busier, choppier price action. Candles[20..22]. Verified: exactly
  // one qualifying gap in the series.
  {
    exercise_id: "fvg-005",
    concept: "FVG",
    prompt: "Mark the Fair Value Gap.",
    instrument: "NQ (prototype data)",
    timeframe: "5m",
    difficulty: 3,
    has_zone: true,
    answer: {
      type: "bullish",
      price_low: 21425.25,
      price_high: 21438.25,
      candle_start: 20,
      candle_end: 22,
      key_candle_index: 21,
    },
    explanation:
      "Candle 1's high (21,425.25) sits below candle 3's low (21,438.25) — a small unfilled imbalance across candle 2 that's easy to miss in this much chop.",
    candles: [
      { time: "09:30", open: 21500, high: 21506.75, low: 21481.25, close: 21492.75 },
      { time: "09:35", open: 21492.75, high: 21501, low: 21484, close: 21497 },
      { time: "09:40", open: 21497, high: 21501.25, low: 21474.5, close: 21481.75 },
      { time: "09:45", open: 21481.75, high: 21493.5, low: 21461.25, close: 21472.25 },
      { time: "09:50", open: 21472.25, high: 21484, low: 21464.75, close: 21470.75 },
      { time: "09:55", open: 21470.75, high: 21479.25, low: 21451.5, close: 21456 },
      { time: "10:00", open: 21456, high: 21469, low: 21445.25, close: 21463.5 },
      { time: "10:05", open: 21463.5, high: 21471.5, low: 21453.5, close: 21465.5 },
      { time: "10:10", open: 21465.5, high: 21471.25, low: 21444.25, close: 21450.75 },
      { time: "10:15", open: 21450.75, high: 21472.25, low: 21447.5, close: 21464.5 },
      { time: "10:20", open: 21464.5, high: 21471.5, low: 21444.25, close: 21449 },
      { time: "10:25", open: 21449, high: 21456.25, low: 21437.5, close: 21443 },
      { time: "10:30", open: 21443, high: 21465.25, low: 21433.75, close: 21462 },
      { time: "10:35", open: 21462, high: 21469.5, low: 21447.5, close: 21458.25 },
      { time: "10:40", open: 21458.25, high: 21464.5, low: 21436, close: 21440.5 },
      { time: "10:45", open: 21440.5, high: 21452.25, low: 21430.5, close: 21434 },
      { time: "10:50", open: 21434, high: 21451.25, low: 21422.25, close: 21441.25 },
      { time: "10:55", open: 21441.25, high: 21446.25, low: 21435, close: 21440.75 },
      { time: "11:00", open: 21440.75, high: 21450, low: 21421, close: 21428 },
      { time: "11:05", open: 21428, high: 21436.25, low: 21404.75, close: 21415.25 },
      // Candle 20 — candle 1 of the formation
      { time: "11:10", open: 21415.25, high: 21425.25, low: 21410.25, close: 21422.25 },
      // Candle 21 — the expansion candle
      { time: "11:15", open: 21422.25, high: 21459.25, low: 21418.25, close: 21456.25 },
      // Candle 22 — candle 3, confirms the gap
      { time: "11:20", open: 21452.25, high: 21470.25, low: 21438.25, close: 21465.25 },
      { time: "11:25", open: 21465.25, high: 21487.25, low: 21454.25, close: 21481.25 },
      { time: "11:30", open: 21481.25, high: 21485, low: 21458.5, close: 21467.75 },
      { time: "11:35", open: 21467.75, high: 21480.5, low: 21462.75, close: 21469.25 },
      { time: "11:40", open: 21469.25, high: 21474.75, low: 21457.25, close: 21461.25 },
      { time: "11:45", open: 21461.25, high: 21484.25, low: 21451.5, close: 21476 },
      { time: "11:50", open: 21476, high: 21487.25, low: 21468.25, close: 21482.25 },
      { time: "11:55", open: 21482.25, high: 21491.25, low: 21454.25, close: 21465.5 },
      { time: "12:00", open: 21465.5, high: 21473.5, low: 21460, close: 21467.75 },
      { time: "12:05", open: 21467.75, high: 21475.75, low: 21464, close: 21468 },
      { time: "12:10", open: 21468, high: 21478, low: 21452.25, close: 21461.5 },
      { time: "12:15", open: 21461.5, high: 21468.75, low: 21452.5, close: 21460.5 },
      { time: "12:20", open: 21460.5, high: 21463.75, low: 21450, close: 21453.75 },
      { time: "12:25", open: 21453.75, high: 21464.5, low: 21437.5, close: 21446.75 },
      { time: "12:30", open: 21446.75, high: 21468.25, low: 21436.5, close: 21461.75 },
      { time: "12:35", open: 21461.75, high: 21465, low: 21446.75, close: 21457.5 },
      { time: "12:40", open: 21457.5, high: 21462.25, low: 21444.5, close: 21449.25 },
      { time: "12:45", open: 21449.25, high: 21455, low: 21423.5, close: 21429.25 },
    ],
  },
  // liq-001: Buy-Side Liquidity — equal highs at candles[8] and [24] (~0.75
  // apart), verified as the only two swing highs anywhere in the series
  // within reach of that level. The zone frames both highs plus a buffer
  // above, where resting buy-stop orders would cluster.
  {
    exercise_id: "liq-001",
    concept: "Liquidity",
    prompt: "Mark the Buy-Side Liquidity.",
    instrument: "NQ (prototype data)",
    timeframe: "5m",
    difficulty: 1,
    has_zone: true,
    answer: {
      type: "buy_side",
      price_low: 21146.75,
      price_high: 21160.5,
      candle_start: 8,
      candle_end: 24,
      key_candle_index: 24,
    },
    explanation:
      "Candles 9 and 25 both put in highs within a point of each other (21,150.50 and 21,149.75) — that resting pool of equal highs is where buy-side stop orders cluster, making it a Buy-Side Liquidity zone.",
    candles: [
      { time: "09:30", open: 21000, high: 21020.75, low: 20997, close: 21016 },
      { time: "09:35", open: 21016, high: 21033, low: 21011.75, close: 21030.25 },
      { time: "09:40", open: 21030.25, high: 21047.5, low: 21025.75, close: 21044.5 },
      { time: "09:45", open: 21044.5, high: 21063.5, low: 21040, close: 21059.5 },
      { time: "09:50", open: 21059.5, high: 21080.25, low: 21056.75, close: 21076.75 },
      { time: "09:55", open: 21076.75, high: 21095.5, low: 21073, close: 21092.25 },
      { time: "10:00", open: 21092.25, high: 21111.25, low: 21089.75, close: 21106.75 },
      { time: "10:05", open: 21106.75, high: 21125.5, low: 21104, close: 21123.5 },
      // Candle 9 — first equal high
      { time: "10:10", open: 21123.5, high: 21150.5, low: 21119.75, close: 21140 },
      { time: "10:15", open: 21140, high: 21143.5, low: 21125.5, close: 21128.25 },
      { time: "10:20", open: 21128.25, high: 21130.25, low: 21114.75, close: 21117 },
      { time: "10:25", open: 21117, high: 21120.75, low: 21102.25, close: 21104.5 },
      { time: "10:30", open: 21104.5, high: 21107.75, low: 21089.25, close: 21093 },
      { time: "10:35", open: 21093, high: 21096.5, low: 21077, close: 21080.75 },
      { time: "10:40", open: 21080.75, high: 21084, low: 21066.25, close: 21068.75 },
      { time: "10:45", open: 21068.75, high: 21072.25, low: 21051.25, close: 21055 },
      { time: "10:50", open: 21055, high: 21068.25, low: 21050.75, close: 21064.75 },
      { time: "10:55", open: 21064.75, high: 21076.25, low: 21061.25, close: 21073.75 },
      { time: "11:00", open: 21073.75, high: 21085.75, low: 21070.25, close: 21082.5 },
      { time: "11:05", open: 21082.5, high: 21096, low: 21080, close: 21092.75 },
      { time: "11:10", open: 21092.75, high: 21106.75, low: 21088, close: 21102.75 },
      { time: "11:15", open: 21102.75, high: 21115.25, low: 21100.25, close: 21111 },
      { time: "11:20", open: 21111, high: 21124.75, low: 21108, close: 21120.25 },
      { time: "11:25", open: 21120.25, high: 21132, low: 21115.75, close: 21128.75 },
      // Candle 25 — second equal high, confirms the liquidity pool
      { time: "11:30", open: 21128.75, high: 21149.75, low: 21126.5, close: 21140 },
      { time: "11:35", open: 21140, high: 21145, low: 21129, close: 21132.5 },
      { time: "11:40", open: 21132.5, high: 21136.5, low: 21122, close: 21125.25 },
      { time: "11:45", open: 21125.25, high: 21129, low: 21114, close: 21117.5 },
      { time: "11:50", open: 21117.5, high: 21119.75, low: 21106.25, close: 21110.75 },
      { time: "11:55", open: 21110.75, high: 21114.75, low: 21101.5, close: 21103.75 },
      { time: "12:00", open: 21103.75, high: 21107.75, low: 21093.25, close: 21097 },
      { time: "12:05", open: 21097, high: 21100.5, low: 21085.75, close: 21090 },
      { time: "12:10", open: 21090, high: 21093.5, low: 21078, close: 21082.75 },
      { time: "12:15", open: 21082.75, high: 21085.75, low: 21070.75, close: 21074.75 },
      { time: "12:20", open: 21074.75, high: 21077.5, low: 21064.75, close: 21067.5 },
      { time: "12:25", open: 21067.5, high: 21071.75, low: 21057.25, close: 21060 },
      { time: "12:30", open: 21060, high: 21062.25, low: 21047, close: 21052 },
      { time: "12:35", open: 21052, high: 21056.5, low: 21040.75, close: 21045.25 },
      { time: "12:40", open: 21045.25, high: 21048.25, low: 21035, close: 21037.75 },
      { time: "12:45", open: 21037.75, high: 21040, low: 21025.75, close: 21030 },
    ],
  },
  // liq-002: Sell-Side Liquidity — equal lows at candles[8] and [24] (~0.75
  // apart), verified as the only two swing lows within reach of that level
  // anywhere in the series.
  {
    exercise_id: "liq-002",
    concept: "Liquidity",
    prompt: "Mark the Sell-Side Liquidity.",
    instrument: "NQ (prototype data)",
    timeframe: "5m",
    difficulty: 1,
    has_zone: true,
    answer: {
      type: "sell_side",
      price_low: 21339.5,
      price_high: 21353.25,
      candle_start: 8,
      candle_end: 24,
      key_candle_index: 24,
    },
    explanation:
      "Candles 9 and 25 both put in lows within a point of each other (21,349.50 and 21,350.25) — that resting pool of equal lows is where sell-side stop orders cluster, making it a Sell-Side Liquidity zone.",
    candles: [
      { time: "09:30", open: 21500, high: 21502.25, low: 21480.75, close: 21483 },
      { time: "09:35", open: 21483, high: 21486.75, low: 21463.75, close: 21467.25 },
      { time: "09:40", open: 21467.25, high: 21471.75, low: 21446, close: 21449.75 },
      { time: "09:45", open: 21449.75, high: 21452, low: 21431, close: 21433 },
      { time: "09:50", open: 21433, high: 21437.25, low: 21411.5, close: 21416.5 },
      { time: "09:55", open: 21416.5, high: 21419.5, low: 21400, close: 21402 },
      { time: "10:00", open: 21402, high: 21404.75, low: 21382, close: 21385.25 },
      { time: "10:05", open: 21385.25, high: 21389.75, low: 21366.5, close: 21370.75 },
      // Candle 9 — first equal low
      { time: "10:10", open: 21370.75, high: 21374.5, low: 21349.5, close: 21360 },
      { time: "10:15", open: 21360, high: 21375.75, low: 21356.75, close: 21372 },
      { time: "10:20", open: 21372, high: 21385.75, low: 21370, close: 21383.5 },
      { time: "10:25", open: 21383.5, high: 21398.25, low: 21379.75, close: 21394.75 },
      { time: "10:30", open: 21394.75, high: 21408.5, low: 21391.25, close: 21406 },
      { time: "10:35", open: 21406, high: 21420.75, low: 21402, close: 21417 },
      { time: "10:40", open: 21417, high: 21430.5, low: 21413, close: 21428 },
      { time: "10:45", open: 21428, high: 21448.25, low: 21425.75, close: 21445 },
      { time: "10:50", open: 21445, high: 21448.25, low: 21430, close: 21435 },
      { time: "10:55", open: 21435, high: 21437.5, low: 21420.75, close: 21425 },
      { time: "11:00", open: 21425, high: 21427.5, low: 21412.5, close: 21414.5 },
      { time: "11:05", open: 21414.5, high: 21419.25, low: 21402, close: 21404.5 },
      { time: "11:10", open: 21404.5, high: 21408.75, low: 21392.25, close: 21396 },
      { time: "11:15", open: 21396, high: 21398.75, low: 21383.25, close: 21387 },
      { time: "11:20", open: 21387, high: 21391, low: 21372.25, close: 21376.75 },
      { time: "11:25", open: 21376.75, high: 21380, low: 21363.5, close: 21367 },
      // Candle 25 — second equal low, confirms the liquidity pool
      { time: "11:30", open: 21367, high: 21369, low: 21350.25, close: 21360 },
      { time: "11:35", open: 21360, high: 21371.5, low: 21357.5, close: 21367 },
      { time: "11:40", open: 21367, high: 21377.5, low: 21362, close: 21374.75 },
      { time: "11:45", open: 21374.75, high: 21386.75, low: 21369.75, close: 21382.5 },
      { time: "11:50", open: 21382.5, high: 21394.75, low: 21378.75, close: 21390.25 },
      { time: "11:55", open: 21390.25, high: 21401.25, low: 21387.75, close: 21397.5 },
      { time: "12:00", open: 21397.5, high: 21409.5, low: 21394.75, close: 21405 },
      { time: "12:05", open: 21405, high: 21416, low: 21402.5, close: 21412 },
      { time: "12:10", open: 21412, high: 21423.5, low: 21408.75, close: 21419.25 },
      { time: "12:15", open: 21419.25, high: 21429.75, low: 21416.5, close: 21427 },
      { time: "12:20", open: 21427, high: 21439, low: 21424.25, close: 21434.5 },
      { time: "12:25", open: 21434.5, high: 21445.75, low: 21430, close: 21441.5 },
      { time: "12:30", open: 21441.5, high: 21452, low: 21438.75, close: 21448.5 },
      { time: "12:35", open: 21448.5, high: 21458.75, low: 21446.25, close: 21455.25 },
      { time: "12:40", open: 21455.25, high: 21464.25, low: 21451.25, close: 21462 },
      { time: "12:45", open: 21462, high: 21474, low: 21458.75, close: 21470 },
    ],
  },
  // liq-003: Buy-Side Liquidity, harder — equal highs at candles[6] and [30]
  // are 3.25 apart (less obvious than liq-001) inside busier price action.
  // Verified: no other swing high anywhere else in the series comes close
  // to that level.
  {
    exercise_id: "liq-003",
    concept: "Liquidity",
    prompt: "Mark the Buy-Side Liquidity.",
    instrument: "NQ (prototype data)",
    timeframe: "5m",
    difficulty: 2,
    has_zone: true,
    answer: {
      type: "buy_side",
      price_low: 21310.25,
      price_high: 21326.5,
      candle_start: 6,
      candle_end: 30,
      key_candle_index: 30,
    },
    explanation:
      "Candles 7 and 31 put in highs about 3 points apart (21,316.50 and 21,313.25) — close enough to count as equal highs and a resting Buy-Side Liquidity pool, even with all the chop around them.",
    candles: [
      { time: "09:30", open: 21200, high: 21219.75, low: 21194.5, close: 21215.75 },
      { time: "09:35", open: 21215.75, high: 21236.25, low: 21212.5, close: 21233.25 },
      { time: "09:40", open: 21233.25, high: 21254.25, low: 21228.75, close: 21250.5 },
      { time: "09:45", open: 21250.5, high: 21272.5, low: 21247, close: 21268.25 },
      { time: "09:50", open: 21268.25, high: 21290.25, low: 21263.25, close: 21284.25 },
      { time: "09:55", open: 21284.25, high: 21302, low: 21280, close: 21298.5 },
      // Candle 7 — first equal high
      { time: "10:00", open: 21298.5, high: 21316.5, low: 21293, close: 21310 },
      { time: "10:05", open: 21310, high: 21314.75, low: 21295.5, close: 21299 },
      { time: "10:10", open: 21299, high: 21303.75, low: 21284.5, close: 21287.75 },
      { time: "10:15", open: 21287.75, high: 21293.75, low: 21269, close: 21274.75 },
      { time: "10:20", open: 21274.75, high: 21278.25, low: 21257.75, close: 21263.75 },
      { time: "10:25", open: 21263.75, high: 21268.75, low: 21244.75, close: 21250 },
      { time: "10:30", open: 21250, high: 21266.5, low: 21245, close: 21261 },
      { time: "10:35", open: 21261, high: 21275.5, low: 21257.5, close: 21272.5 },
      { time: "10:40", open: 21272.5, high: 21288.5, low: 21267.5, close: 21283.25 },
      { time: "10:45", open: 21283.25, high: 21298, low: 21278.75, close: 21293.75 },
      { time: "10:50", open: 21293.75, high: 21309.75, low: 21290.25, close: 21305.75 },
      { time: "10:55", open: 21305.75, high: 21315, low: 21302.5, close: 21315 },
      { time: "11:00", open: 21315, high: 21315, low: 21300.25, close: 21305 },
      { time: "11:05", open: 21305, high: 21309.25, low: 21290, close: 21293.25 },
      { time: "11:10", open: 21293.25, high: 21298.75, low: 21277, close: 21280.5 },
      { time: "11:15", open: 21280.5, high: 21285.75, low: 21265.5, close: 21268.75 },
      { time: "11:20", open: 21268.75, high: 21273, low: 21254.5, close: 21258.25 },
      { time: "11:25", open: 21258.25, high: 21262.5, low: 21241.5, close: 21245 },
      { time: "11:30", open: 21245, high: 21256.5, low: 21241.25, close: 21253.5 },
      { time: "11:35", open: 21253.5, high: 21266.75, low: 21247.75, close: 21261.5 },
      { time: "11:40", open: 21261.5, high: 21277, low: 21257, close: 21271.25 },
      { time: "11:45", open: 21271.25, high: 21283.5, low: 21266.75, close: 21280.5 },
      { time: "11:50", open: 21280.5, high: 21294.5, low: 21276.5, close: 21290 },
      { time: "11:55", open: 21290, high: 21305.25, low: 21286.25, close: 21300.25 },
      // Candle 31 — second equal high, confirms the liquidity pool
      { time: "12:00", open: 21300.25, high: 21313.25, low: 21294.5, close: 21308 },
      { time: "12:05", open: 21308, high: 21311.25, low: 21295.25, close: 21300.25 },
      { time: "12:10", open: 21300.25, high: 21305.75, low: 21285.5, close: 21291 },
      { time: "12:15", open: 21291, high: 21294.75, low: 21276.75, close: 21282.25 },
      { time: "12:20", open: 21282.25, high: 21286.5, low: 21270.25, close: 21274 },
      { time: "12:25", open: 21274, high: 21279.25, low: 21260.5, close: 21264.5 },
      { time: "12:30", open: 21264.5, high: 21270, low: 21251.5, close: 21256 },
      { time: "12:35", open: 21256, high: 21259.25, low: 21243.25, close: 21247 },
      { time: "12:40", open: 21247, high: 21252.25, low: 21236, close: 21239.25 },
      { time: "12:45", open: 21239.25, high: 21243, low: 21226.5, close: 21230 },
    ],
  },
  // liq-004: has_zone is false. Candles[9] and [25] look like they might be
  // equal highs at a glance, but they're 16.25 points apart — too far to
  // represent resting liquidity at one level. Verified: no swing high
  // anywhere in the series is within 15 points of either.
  {
    exercise_id: "liq-004",
    concept: "Liquidity",
    prompt: "Mark the Buy-Side Liquidity.",
    instrument: "NQ (prototype data)",
    timeframe: "5m",
    difficulty: 2,
    has_zone: false,
    answer: null,
    explanation:
      "Candles 9 and 25 look like they might be equal highs, but they're 16.25 points apart (21,238.50 vs 21,222.25) — too far apart to represent orders resting at one level, so there's no real liquidity pool here.",
    distractor_note:
      "Candles 9 and 25 look like they might be equal highs, but they're 16.25 points apart (21,238.50 vs 21,222.25) — too far apart to represent orders resting at one level, so there's no real liquidity pool here.",
    candles: [
      { time: "09:30", open: 21100, high: 21119.5, low: 21096.25, close: 21116 },
      { time: "09:35", open: 21116, high: 21132.75, low: 21111.5, close: 21129.5 },
      { time: "09:40", open: 21129.5, high: 21148.75, low: 21126.5, close: 21144.5 },
      { time: "09:45", open: 21144.5, high: 21164.25, low: 21141.5, close: 21159.75 },
      { time: "09:50", open: 21159.75, high: 21178, low: 21156.5, close: 21175.5 },
      { time: "09:55", open: 21175.5, high: 21192.25, low: 21171, close: 21190 },
      { time: "10:00", open: 21190, high: 21207.75, low: 21187.5, close: 21202.75 },
      { time: "10:05", open: 21202.75, high: 21221.25, low: 21198.75, close: 21218.25 },
      // Candle 9 — first high (not actually equal to the second)
      { time: "10:10", open: 21218.25, high: 21238.5, low: 21213.5, close: 21230 },
      { time: "10:15", open: 21230, high: 21232.25, low: 21217.5, close: 21219.75 },
      { time: "10:20", open: 21219.75, high: 21222.25, low: 21203.75, close: 21207.5 },
      { time: "10:25", open: 21207.5, high: 21210.75, low: 21192.75, close: 21196 },
      { time: "10:30", open: 21196, high: 21198.75, low: 21182.25, close: 21185.5 },
      { time: "10:35", open: 21185.5, high: 21188, low: 21171, close: 21173.75 },
      { time: "10:40", open: 21173.75, high: 21176.25, low: 21160.5, close: 21163.25 },
      { time: "10:45", open: 21163.25, high: 21165.75, low: 21146.25, close: 21150 },
      { time: "10:50", open: 21150, high: 21159.75, low: 21147, close: 21156.75 },
      { time: "10:55", open: 21156.75, high: 21165.25, low: 21154, close: 21163.25 },
      { time: "11:00", open: 21163.25, high: 21174.75, low: 21161, close: 21170.5 },
      { time: "11:05", open: 21170.5, high: 21182.75, low: 21168.5, close: 21178 },
      { time: "11:10", open: 21178, high: 21189.5, low: 21173.75, close: 21184.75 },
      { time: "11:15", open: 21184.75, high: 21194, low: 21181.25, close: 21191.25 },
      { time: "11:20", open: 21191.25, high: 21201, low: 21187, close: 21198.25 },
      { time: "11:25", open: 21198.25, high: 21208.75, low: 21193.5, close: 21205.75 },
      // Candle 25 — second high, only ~16 points from candle 9 (too far)
      { time: "11:30", open: 21205.75, high: 21222.25, low: 21202.5, close: 21212 },
      { time: "11:35", open: 21212, high: 21215.75, low: 21203.75, close: 21207.5 },
      { time: "11:40", open: 21207.5, high: 21211, low: 21201.5, close: 21203.75 },
      { time: "11:45", open: 21203.75, high: 21206.5, low: 21197.25, close: 21199.25 },
      { time: "11:50", open: 21199.25, high: 21201.75, low: 21193.25, close: 21195.25 },
      { time: "11:55", open: 21195.25, high: 21199.25, low: 21188, close: 21191.25 },
      { time: "12:00", open: 21191.25, high: 21193.75, low: 21183, close: 21187 },
      { time: "12:05", open: 21187, high: 21189.5, low: 21180.5, close: 21182.75 },
      { time: "12:10", open: 21182.75, high: 21187.75, low: 21175.5, close: 21178.5 },
      { time: "12:15", open: 21178.5, high: 21180.75, low: 21170.5, close: 21174 },
      { time: "12:20", open: 21174, high: 21178.75, low: 21167.25, close: 21170 },
      { time: "12:25", open: 21170, high: 21174.5, low: 21161, close: 21165.5 },
      { time: "12:30", open: 21165.5, high: 21168.25, low: 21157.25, close: 21161.75 },
      { time: "12:35", open: 21161.75, high: 21165.75, low: 21154, close: 21157.75 },
      { time: "12:40", open: 21157.75, high: 21160.75, low: 21150.25, close: 21153.5 },
      { time: "12:45", open: 21153.5, high: 21158.25, low: 21145.5, close: 21150 },
    ],
  },
  // liq-005: Sell-Side Liquidity, harder — equal lows at candles[6] and [30]
  // are 3.25 apart inside busier price action. Verified: no other swing low
  // anywhere else in the series comes close to that level.
  {
    exercise_id: "liq-005",
    concept: "Liquidity",
    prompt: "Mark the Sell-Side Liquidity.",
    instrument: "NQ (prototype data)",
    timeframe: "5m",
    difficulty: 3,
    has_zone: true,
    answer: {
      type: "sell_side",
      price_low: 21481.5,
      price_high: 21497.75,
      candle_start: 6,
      candle_end: 30,
      key_candle_index: 30,
    },
    explanation:
      "Candles 7 and 31 put in lows about 3 points apart (21,491.50 and 21,494.75) — close enough to count as equal lows and a resting Sell-Side Liquidity pool, even with the noise around them.",
    candles: [
      { time: "09:30", open: 21600, high: 21605, low: 21581.5, close: 21585.25 },
      { time: "09:35", open: 21585.25, high: 21591, low: 21566.75, close: 21571.25 },
      { time: "09:40", open: 21571.25, high: 21575, low: 21553.5, close: 21557 },
      { time: "09:45", open: 21557, high: 21560.75, low: 21538.25, close: 21542.75 },
      { time: "09:50", open: 21542.75, high: 21547, low: 21524, close: 21527.25 },
      { time: "09:55", open: 21527.25, high: 21533, low: 21510.75, close: 21514.5 },
      // Candle 7 — first equal low
      { time: "10:00", open: 21514.5, high: 21518.75, low: 21491.5, close: 21500 },
      { time: "10:05", open: 21500, high: 21515.5, low: 21496.75, close: 21512 },
      { time: "10:10", open: 21512, high: 21529.5, low: 21507.25, close: 21524.5 },
      { time: "10:15", open: 21524.5, high: 21540, low: 21520.25, close: 21536.5 },
      { time: "10:20", open: 21536.5, high: 21552, low: 21530.75, close: 21548 },
      { time: "10:25", open: 21548, high: 21559.5, low: 21543.5, close: 21555 },
      { time: "10:30", open: 21555, high: 21558, low: 21540.25, close: 21545 },
      { time: "10:35", open: 21545, high: 21549, low: 21531.75, close: 21536.75 },
      { time: "10:40", open: 21536.75, high: 21542.25, low: 21523.5, close: 21526.5 },
      { time: "10:45", open: 21526.5, high: 21529.75, low: 21514.5, close: 21518 },
      { time: "10:50", open: 21518, high: 21522, low: 21502.25, close: 21507 },
      { time: "10:55", open: 21507, high: 21513, low: 21492.25, close: 21497 },
      { time: "11:00", open: 21497, high: 21512.75, low: 21492.25, close: 21508 },
      { time: "11:05", open: 21508, high: 21521.5, low: 21505, close: 21517.25 },
      { time: "11:10", open: 21517.25, high: 21531.5, low: 21513.25, close: 21528.25 },
      { time: "11:15", open: 21528.25, high: 21545.75, low: 21522.5, close: 21540.25 },
      { time: "11:20", open: 21540.25, high: 21553.5, low: 21536.75, close: 21550.25 },
      { time: "11:25", open: 21550.25, high: 21564, low: 21545.5, close: 21560 },
      { time: "11:30", open: 21560, high: 21563, low: 21548.25, close: 21552.5 },
      { time: "11:35", open: 21552.5, high: 21557, low: 21539, close: 21543 },
      { time: "11:40", open: 21543, high: 21546.25, low: 21530.75, close: 21535.5 },
      { time: "11:45", open: 21535.5, high: 21539.75, low: 21523.25, close: 21528 },
      { time: "11:50", open: 21528, high: 21533.5, low: 21514.25, close: 21519.5 },
      { time: "11:55", open: 21519.5, high: 21524.5, low: 21505.5, close: 21510 },
      // Candle 31 — second equal low, confirms the liquidity pool
      { time: "12:00", open: 21510, high: 21514, low: 21494.75, close: 21500 },
      { time: "12:05", open: 21500, high: 21514.5, low: 21495.25, close: 21510.25 },
      { time: "12:10", open: 21510.25, high: 21521.25, low: 21505, close: 21518 },
      { time: "12:15", open: 21518, high: 21530.75, low: 21514.75, close: 21527.75 },
      { time: "12:20", open: 21527.75, high: 21541.5, low: 21524.25, close: 21537 },
      { time: "12:25", open: 21537, high: 21552.75, low: 21533, close: 21547.25 },
      { time: "12:30", open: 21547.25, high: 21560.5, low: 21544, close: 21555.5 },
      { time: "12:35", open: 21555.5, high: 21569, low: 21550.25, close: 21565.25 },
      { time: "12:40", open: 21565.25, high: 21576.25, low: 21560, close: 21573 },
      { time: "12:45", open: 21573, high: 21584.5, low: 21568.5, close: 21580 },
    ],
  },
];

export function getExercise(exerciseId: string): Exercise | undefined {
  return exercises.find((exercise) => exercise.exercise_id === exerciseId);
}

export function getExerciseIdsByConcept(concept: Concept): string[] {
  return exercises
    .filter((exercise) => exercise.concept === concept)
    .map((exercise) => exercise.exercise_id);
}
