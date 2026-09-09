// Exercise data shape follows PRD-MVP-V1.md Section 5 exactly. Field names
// are kept snake_case to match the PRD's Exercise definition so the data
// contract is easy to cross-reference with the doc.

export type Candle = {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
};

export type FvgAnswer = {
  type: "bullish" | "bearish";
  /** Bottom of the gap. */
  price_low: number;
  /** Top of the gap. */
  price_high: number;
  /** Index of candle 1 of the three-candle formation. */
  candle_start: number;
  /** Index of candle 3 of the three-candle formation. */
  candle_end: number;
};

export type Exercise = {
  exercise_id: string;
  concept: "FVG";
  /** Prototype data, labeled as such — not real market data. */
  instrument: string;
  timeframe: string;
  difficulty: 1 | 2 | 3;
  candles: Candle[];
  has_fvg: boolean;
  /** null when has_fvg is false. */
  answer: FvgAnswer | null;
  explanation: string;
  /** Required when has_fvg is false. */
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
    instrument: "NQ (prototype data)",
    timeframe: "5m",
    difficulty: 1,
    has_fvg: true,
    answer: {
      type: "bullish",
      price_low: 21107.25,
      price_high: 21139.25,
      candle_start: 19,
      candle_end: 21,
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
    instrument: "NQ (prototype data)",
    timeframe: "5m",
    difficulty: 1,
    has_fvg: true,
    answer: {
      type: "bullish",
      price_low: 21443,
      price_high: 21481,
      candle_start: 12,
      candle_end: 14,
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
    instrument: "NQ (prototype data)",
    timeframe: "5m",
    difficulty: 2,
    has_fvg: true,
    answer: {
      type: "bearish",
      price_low: 21546.25,
      price_high: 21582.25,
      candle_start: 22,
      candle_end: 24,
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
  // fvg-004: has_fvg is false. Candles[17..19] look like a bullish FVG at a
  // glance but candle 1's high and candle 3's low overlap by 1 point, so no
  // imbalance actually exists — a deliberate near-miss. Verified: zero
  // qualifying gaps anywhere in the series.
  {
    exercise_id: "fvg-004",
    concept: "FVG",
    instrument: "NQ (prototype data)",
    timeframe: "5m",
    difficulty: 2,
    has_fvg: false,
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
    instrument: "NQ (prototype data)",
    timeframe: "5m",
    difficulty: 3,
    has_fvg: true,
    answer: {
      type: "bullish",
      price_low: 21425.25,
      price_high: 21438.25,
      candle_start: 20,
      candle_end: 22,
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
];

export function getExercise(exerciseId: string): Exercise | undefined {
  return exercises.find((exercise) => exercise.exercise_id === exerciseId);
}
