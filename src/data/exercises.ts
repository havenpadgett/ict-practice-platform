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
];

export function getExercise(exerciseId: string): Exercise | undefined {
  return exercises.find((exercise) => exercise.exercise_id === exerciseId);
}
