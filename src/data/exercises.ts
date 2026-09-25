// Exercise data shape follows PRD-MVP-V1.md Section 5, generalized in
// Phase 4 to cover more than one concept. Field names are kept snake_case
// to match the PRD's Exercise definition so the data contract is easy to
// cross-reference with the doc.

import { freeTradeScenarios } from "@/data/free-trade-scenarios";
import { premiumDiscountExercises } from "@/data/premium-discount-exercises";
import { realScenarios } from "@/data/real-scenarios";
import { timeLiquidityExercises } from "@/data/time-liquidity-exercises";
import type { Concept } from "@/lib/concepts";

export type Candle = {
  /** Display label, "HH:MM". Constructed exercises use only this. */
  time: string;
  /** Optional real timestamp: ISO 8601 in New York wall-clock time with the
   * ET offset, e.g. "2026-03-03T09:30:00-05:00" (see src/lib/time-context.ts).
   * When every candle in an exercise has one, the chart shows date/time
   * labels, trading-day separators, and NY AM session shading. */
  timestamp?: string;
  open: number;
  high: number;
  low: number;
  close: number;
};

export type ZoneAnswer = {
  /** Direction label — "bullish" | "bearish" for FVG. Descriptive only;
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
   * test — always candle_start + 1 (the middle candle of FVG's
   * three-candle formation). Stored explicitly rather than assumed. */
  key_candle_index: number;
};

export type LevelAnswer = {
  /** Direction label — "buy_side" | "sell_side" for Liquidity. Descriptive
   * only; grading never branches on it. */
  type: string;
  /** The true price level (the average of the equal highs/lows it rests on). */
  price: number;
  /** How far the user's placed line may be from `price` and still count as
   * correct. Set explicitly per exercise rather than computed — same
   * reasoning as ZoneAnswer's key_candle_index. */
  tolerance: number;
};

export type ChoiceOption = {
  /** Stored on the attempt and compared against correct_choice — stable
   * per option, independent of display wording. */
  value: string;
  label: string;
};

/** A swing high and swing low marked on a Premium/Discount chart. Shown
 * from the start (the exercise tests reading price's location in the range,
 * not finding the range); the equilibrium line is revealed after grading. */
export type DealingRange = {
  high: number;
  low: number;
  high_index: number;
  low_index: number;
};

export type ChoiceAnswer = {
  correct_choice: string;
  /** The Fair Value Gap this exercise is asking about (FVG/IFVG respected
   * vs. disrespected). Unlike zone grading's revealed-after-submit answer,
   * this is shown on the chart from the start — the exercise isn't testing
   * whether the user can find the gap, only whether they can read what
   * price did after it, so hiding it would just make the chart harder to
   * read for no pedagogical reason. */
  fvg_zone?: {
    price_low: number;
    price_high: number;
    candle_start: number;
    candle_end: number;
  };
  /** Premium/Discount exercises: the dealing range being asked about. */
  dealing_range?: DealingRange;
};

/** Where a real-data scenario came from and whether a human has checked it
 * (docs/SCENARIO-VALIDATION.md). Written by scripts/build_scenario.py with
 * human_reviewed: false; the reviewer fills in the review fields on
 * promotion. Constructed exercises have no provenance. */
export type ScenarioProvenance = {
  data_source: string;
  symbol: string;
  date_range: { start: string; end: string };
  /** The scripts/detect.py rule that flagged this scenario. */
  detection_rule: string;
  candidate_id: string;
  detection_params: Record<string, unknown>;
  detection_notes: string;
  /** SHA-256 of the raw input CSV, so the scenario can be traced back to the
   * exact file it was built from. */
  input_sha256: string;
  built_at: string;
  human_reviewed: boolean;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
};

type ExerciseBase = {
  exercise_id: string;
  concept: Concept;
  /** Prototype data, labeled as such — not real market data. */
  instrument: string;
  timeframe: string;
  difficulty: 1 | 2 | 3;
  candles: Candle[];
  /** Prompt shown above the chart. Written per exercise rather than derived
   * from a single template — different exercises within the same concept
   * can genuinely ask different questions (e.g. Liquidity's "strongest X"
   * exercises vs. its "are there equal highs" one), so one rigid template
   * can't cover them. Every prompt must still be worded so it never reveals
   * whether a valid answer exists — that discipline has to be applied by
   * hand here, checked on every new prompt. */
  prompt: string;
  /** Human-readable name of what this exercise's answer actually is, e.g.
   * "Fair Value Gap" or "Buy-Side Liquidity" — used to build the "no X" /
   * "the correct answer was X" feedback statements in grading.ts. */
  answerLabel: string;
  /** Reasoning shown as feedback — qualitative only, no coordinates (the
   * grader appends those). */
  explanation: string;
  /** Required when has_answer is false; the near-miss explanation. Numbers
   * describing the near-miss itself are hand-written here since there's no
   * structured data to derive them from. */
  distractor_note?: string;
  /** Present on real-data scenarios only (src/data/real-scenarios/). */
  provenance?: ScenarioProvenance;
};

/** Zone and level exercises always carry a "no answer exists" button —
 * its label is written per exercise (not derived from answerLabel) since
 * it must match whatever this specific exercise is asking about, e.g.
 * liq-004 asks about equal highs specifically, not "a liquidity level"
 * generally. Choice exercises have no such button: every one of them has
 * a definite correct option among the choices offered, so there's nothing
 * for "no answer" to mean. */
type DrawableExerciseBase = ExerciseBase & {
  noAnswerLabel: string;
};

export type ZoneExercise = DrawableExerciseBase & {
  answer_type: "zone";
  has_answer: boolean;
  /** null when has_answer is false. */
  answer: ZoneAnswer | null;
};

export type LevelExercise = DrawableExerciseBase & {
  answer_type: "level";
  has_answer: boolean;
  /** null when has_answer is false. */
  answer: LevelAnswer | null;
};

export type ChoiceExercise = ExerciseBase & {
  answer_type: "choice";
  options: ChoiceOption[];
  answer: ChoiceAnswer;
};

// Guided Entry (docs/CURRICULUM.md): a four-step framework — bias, entry,
// stop, target — graded as a chain rather than four independent guesses.
// Entry/stop/target are each a price + tolerance, graded the same way as
// LevelAnswer above (the user places a line, not a box); "zone" in the PRD's
// phrasing just means the entry is anchored to a real level (an FVG, an
// IFVG, or a broken structural level) rather than open space, not that it's
// drawn as a box.

export type GuidedBias = "bullish" | "bearish" | "unclear";

export type GuidedLevelAnswer = {
  price: number;
  /** How far the user's placed line may be from `price` and still count as
   * correct — same reasoning as LevelAnswer.tolerance. */
  tolerance: number;
};

export type GuidedStepExplanations = {
  bias: string;
  entry: string;
  stop: string;
  target: string;
};

export type GuidedAnswer = {
  bias: GuidedBias;
  /** Null whenever there's no valid level to place — bias is unclear, or
   * bias is clear but no entry/stop/target actually exists. The correct
   * action from that step onward is "No Trade" (src/lib/guided-grading.ts). */
  entry: GuidedLevelAnswer | null;
  stop: GuidedLevelAnswer | null;
  target: GuidedLevelAnswer | null;
  /** Minimum acceptable risk-to-reward (PRD/curriculum: 2:1). */
  min_rr: number;
  /** Whether this scenario is actually a valid trade end to end — false
   * when bias is unclear, no valid entry exists, or the best achievable
   * R:R falls below min_rr. See docs/CURRICULUM.md, Guided Entry. */
  is_valid_setup: boolean;
  /** Shown per-step in feedback regardless of how far the user actually
   * got — e.g. the entry explanation still displays if the user bailed
   * with "No Trade" right after placing an entry. */
  step_explanations: GuidedStepExplanations;
  /** Shown once, alongside the overall verdict. */
  overall_explanation: string;
};

export type GuidedExercise = ExerciseBase & {
  answer_type: "guided";
  answer: GuidedAnswer;
};

// Free Trade (docs/CURRICULUM.md): historical playback. `candles` is the
// starting window shown up front; `hidden_candles` are revealed one at a
// time and are never rendered (or used to scale the chart) until revealed.
// The user decides if/when to trade, and is graded on process against the
// answer below — never on whether the trade happened to win.

export type FreeTradeDirection = "long" | "short";

/** "none" when structure never gives a direction worth trading. */
export type FreeTradeBias = FreeTradeDirection | "none";

export type FreeTradePriceZone = {
  price_low: number;
  price_high: number;
};

export type FreeTradeEntryZone = FreeTradePriceZone & {
  /** Index (into candles followed by hidden_candles) of the first candle
   * whose close counts as an entry — the setup hasn't formed before this,
   * so an entry at the same price earlier isn't the same trade. */
  earliest_index: number;
};

export type FreeTradeAnswer = {
  intended_bias: FreeTradeBias;
  /** False for scenarios where the correct decision is to not trade at
   * all. Entry/stop/target may still be filled in as reference levels
   * (e.g. a clean setup whose R:R falls short), or null when nothing
   * qualifies. */
  is_valid_setup: boolean;
  entry_zone: FreeTradeEntryZone | null;
  stop_zone: FreeTradePriceZone | null;
  target: number | null;
  /** Minimum acceptable risk-to-reward (curriculum: 2:1). */
  min_rr: number;
};

export type FreeTradeExercise = ExerciseBase & {
  answer_type: "free";
  title: string;
  hidden_candles: Candle[];
  answer: FreeTradeAnswer;
};

export type Exercise = ZoneExercise | LevelExercise | ChoiceExercise | GuidedExercise | FreeTradeExercise;

// fvg-001: a single bullish FVG sits at candles[19..21]. Candle 19's high
// (21107.25) is below candle 21's low (21139.25) — candle 20 is the large
// expansion candle that leaves that range unfilled. Every other 3-candle
// window in this series was checked by generation script and does not
// qualify as a gap (bullish or bearish), per the PRD's ambiguity rule
// (exactly one valid FVG, never two).
const conceptExercises: Exercise[] = [
  {
    exercise_id: "fvg-001",
    concept: "FVG",
    answer_type: "zone",
    answerLabel: "Fair Value Gap",
    prompt: "Identify the Fair Value Gap, if there is one.",
    noAnswerLabel: "No FVG present",
    instrument: "NQ (prototype data)",
    timeframe: "5m",
    difficulty: 1,
    has_answer: true,
    answer: {
      type: "bullish",
      price_low: 21107.25,
      price_high: 21139.25,
      candle_start: 19,
      candle_end: 21,
      key_candle_index: 20,
    },
    explanation:
      "This is a real Fair Value Gap. A strong up move jumps straight through a price range without any trading inside it, and price hasn't come back to trade through that range since. No trading in a range means it's still empty — that's what makes it a Fair Value Gap.",
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
    answer_type: "zone",
    answerLabel: "Fair Value Gap",
    prompt: "Identify the Fair Value Gap, if there is one.",
    noAnswerLabel: "No FVG present",
    instrument: "NQ (prototype data)",
    timeframe: "5m",
    difficulty: 1,
    has_answer: true,
    answer: {
      type: "bullish",
      price_low: 21443,
      price_high: 21481,
      candle_start: 12,
      candle_end: 14,
      key_candle_index: 13,
    },
    explanation:
      "This is a real Fair Value Gap. A strong up move jumps straight through a price range without any trading inside it, and price hasn't come back to trade through that range since. No trading in a range means it's still empty — that's what makes it a Fair Value Gap.",
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
    answer_type: "zone",
    answerLabel: "Fair Value Gap",
    prompt: "Identify the Fair Value Gap, if there is one.",
    noAnswerLabel: "No FVG present",
    instrument: "NQ (prototype data)",
    timeframe: "5m",
    difficulty: 2,
    has_answer: true,
    answer: {
      type: "bearish",
      price_low: 21546.25,
      price_high: 21582.25,
      candle_start: 22,
      candle_end: 24,
      key_candle_index: 23,
    },
    explanation:
      "This is a real Fair Value Gap. A strong down move drops straight through a price range without any trading inside it, and price hasn't come back to trade through that range since. Bearish gaps like this work the same as the bullish kind, just upside down: the empty range sits above where price ended up instead of below it.",
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
  // fvg-004: has_answer is false. Candles[17..19] look like a bullish FVG at a
  // glance but candle 1's high and candle 3's low overlap by 1 point, so no
  // imbalance actually exists — a deliberate near-miss. Verified: zero
  // qualifying gaps anywhere in the series.
  {
    exercise_id: "fvg-004",
    concept: "FVG",
    answer_type: "zone",
    answerLabel: "Fair Value Gap",
    prompt: "Identify the Fair Value Gap, if there is one.",
    noAnswerLabel: "No FVG present",
    instrument: "NQ (prototype data)",
    timeframe: "5m",
    difficulty: 2,
    has_answer: false,
    answer: null,
    explanation:
      "Two candles here look like they might form a bullish Fair Value Gap at a glance. But the high right before the rally and the low right after it actually overlap by about a point instead of leaving a gap between them. Since price did trade through that tiny overlapping range, there's no empty space left behind — no Fair Value Gap.",
    distractor_note:
      "Two candles here look like they might form a bullish Fair Value Gap at a glance. But the high right before the rally and the low right after it actually overlap by about a point instead of leaving a gap between them. Since price did trade through that tiny overlapping range, there's no empty space left behind — no Fair Value Gap.",
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
    answer_type: "zone",
    answerLabel: "Fair Value Gap",
    prompt: "Identify the Fair Value Gap, if there is one.",
    noAnswerLabel: "No FVG present",
    instrument: "NQ (prototype data)",
    timeframe: "5m",
    difficulty: 3,
    has_answer: true,
    answer: {
      type: "bullish",
      price_low: 21425.25,
      price_high: 21438.25,
      candle_start: 20,
      candle_end: 22,
      key_candle_index: 21,
    },
    explanation:
      "This is a real Fair Value Gap, just a small one. A strong up move skips over a narrow price range without any trading inside it, and even with all the choppy back-and-forth around it, price never actually trades back through that range. Small gaps like this are easy to miss in a busy chart, but the same rule applies: no trading in a range means it's still empty.",
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
  // liq-001: the strongest Buy-Side Liquidity on this chart — equal highs
  // at candles[8] and [24] (~0.75 apart), verified as the only two swing
  // highs anywhere in the series within reach of that level. Per
  // docs/CURRICULUM.md, liquidity rests above ANY swing high; this is the
  // strongest pool here because two touches cluster at the same price.
  {
    exercise_id: "liq-001",
    concept: "Liquidity",
    answer_type: "level",
    prompt: "Mark the strongest Buy-Side Liquidity, if there is one.",
    answerLabel: "Buy-Side Liquidity",
    noAnswerLabel: "No Buy-Side Liquidity present",
    instrument: "NQ (prototype data)",
    timeframe: "5m",
    difficulty: 1,
    has_answer: true,
    answer: {
      type: "buy_side",
      // Average of the two equal highs (21150.50 and 21149.75).
      price: 21150.125,
      tolerance: 6,
    },
    explanation:
      "This is the strongest Buy-Side Liquidity on the chart. Two separate highs land within a point of each other. Every high has some resting stop orders waiting just above it, but two highs landing at almost the same price stack those waiting orders into one bigger pool — bigger than any single high nearby has on its own.",
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
  // liq-002: the strongest Sell-Side Liquidity on this chart — equal lows
  // at candles[8] and [24] (~0.75 apart), verified as the only two swing
  // lows within reach of that level anywhere in the series.
  {
    exercise_id: "liq-002",
    concept: "Liquidity",
    answer_type: "level",
    prompt: "Mark the strongest Sell-Side Liquidity, if there is one.",
    answerLabel: "Sell-Side Liquidity",
    noAnswerLabel: "No Sell-Side Liquidity present",
    instrument: "NQ (prototype data)",
    timeframe: "5m",
    difficulty: 1,
    has_answer: true,
    answer: {
      type: "sell_side",
      // Average of the two equal lows (21349.50 and 21350.25).
      price: 21349.875,
      tolerance: 6,
    },
    explanation:
      "This is the strongest Sell-Side Liquidity on the chart. Two separate lows land within a point of each other. Every low has some resting stop orders waiting just below it, but two lows landing at almost the same price stack those waiting orders into one bigger pool — bigger than any single low nearby has on its own.",
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
  // liq-003: the strongest Buy-Side Liquidity, harder — equal highs at
  // candles[6] and [30] are 3.25 apart (less obvious than liq-001) inside
  // busier price action. Verified: no other swing high anywhere else in
  // the series comes close to that level.
  {
    exercise_id: "liq-003",
    concept: "Liquidity",
    answer_type: "level",
    prompt: "Mark the strongest Buy-Side Liquidity, if there is one.",
    answerLabel: "Buy-Side Liquidity",
    noAnswerLabel: "No Buy-Side Liquidity present",
    instrument: "NQ (prototype data)",
    timeframe: "5m",
    difficulty: 2,
    has_answer: true,
    answer: {
      type: "buy_side",
      // Average of the two equal highs (21316.50 and 21313.25).
      price: 21314.875,
      tolerance: 6,
    },
    explanation:
      "This is the strongest Buy-Side Liquidity on the chart. Two highs land close enough together, just a few points apart, to count as the same level even with all the choppy price action around them. Two highs stacked at roughly one price still make a bigger pool of waiting orders than any single high nearby — it's just harder to spot in the noise.",
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
  // liq-004: has_answer is false — the question here is specifically "are
  // there equal highs", not "is there liquidity" (there always is, per
  // docs/CURRICULUM.md — above candles[8] and [24] individually, just as
  // two separate small pools rather than one reinforced pool). Those two
  // highs are 16.25 points apart, too far to count as equal. Verified: no
  // swing high anywhere in the series is within 15 points of either.
  {
    exercise_id: "liq-004",
    concept: "Liquidity",
    answer_type: "level",
    prompt: "Mark the equal highs, if there are any.",
    answerLabel: "equal highs",
    noAnswerLabel: "No equal highs present",
    instrument: "NQ (prototype data)",
    timeframe: "5m",
    difficulty: 2,
    has_answer: false,
    answer: null,
    explanation:
      "Two highs on this chart land at clearly different prices, about 16 points apart — too far apart to call them equal. Each one still has a small pool of resting orders waiting above it on its own, but neither gets stacked with a second touch at the same price, so neither becomes the bigger, reinforced pool that equal highs would create.",
    distractor_note:
      "Two highs on this chart land at clearly different prices, about 16 points apart — too far apart to call them equal. Each one still has a small pool of resting orders waiting above it on its own, but neither gets stacked with a second touch at the same price, so neither becomes the bigger, reinforced pool that equal highs would create.",
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
  // liq-005: the strongest Sell-Side Liquidity, harder — equal lows at
  // candles[6] and [30] are 3.25 apart inside busier price action.
  // Verified: no other swing low anywhere else in the series comes close
  // to that level.
  {
    exercise_id: "liq-005",
    concept: "Liquidity",
    answer_type: "level",
    prompt: "Mark the strongest Sell-Side Liquidity, if there is one.",
    answerLabel: "Sell-Side Liquidity",
    noAnswerLabel: "No Sell-Side Liquidity present",
    instrument: "NQ (prototype data)",
    timeframe: "5m",
    difficulty: 3,
    has_answer: true,
    answer: {
      type: "sell_side",
      // Average of the two equal lows (21491.50 and 21494.75).
      price: 21493.125,
      tolerance: 6,
    },
    explanation:
      "This is the strongest Sell-Side Liquidity on the chart. Two lows land close enough together, just a few points apart, to count as the same level even with the noisy price action around them. Two lows stacked at roughly one price still make a bigger pool of waiting orders than any single low nearby — it's just harder to spot in the noise.",
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
  // mss-001: clear bullish-to-bearish shift. Uptrend makes HH1 (candle 6,
  // 21,120), HL1 (candle 10, 21,055), HH2 (candle 16, 21,205), HL2 (candle
  // 21, 21,145). Candle 26 fails to exceed HH2 (21,178 < 21,205) — a lower
  // high. Candle 31 then closes at 21,075, a clean body close below HL2's
  // 21,145 — the KEY LEVEL. Verified: every low from candle 21 through
  // candle 30 stays at or above 21,145 (no premature break), and the
  // 21,205 high is the highest point anywhere in the series (the lower
  // high genuinely fails to exceed it).
  {
    exercise_id: "mss-001",
    concept: "MSS",
    answer_type: "level",
    answerLabel: "Market Structure Shift",
    prompt: "Mark the swing level whose break confirmed the Market Structure Shift, if one occurred.",
    noAnswerLabel: "No Market Structure Shift present",
    instrument: "NQ (prototype data)",
    timeframe: "5m",
    difficulty: 1,
    has_answer: true,
    answer: {
      type: "bearish",
      price: 21145,
      tolerance: 6,
    },
    explanation:
      "This is a real Market Structure Shift. Price had been making higher highs and higher lows — a clean uptrend. Then a rally attempt fails to reach a new high, and the next real move is a strong candle that closes well below the most recent higher low. A failed new high, followed by a decisive close beneath the last higher low, is exactly what confirms a shift from bullish to bearish structure.",
    candles: [
      { time: "09:30", open: 20985, high: 21003, low: 20982, close: 21000 },
      { time: "09:35", open: 21000, high: 21026.25, low: 20997, close: 21023.25 },
      { time: "09:40", open: 21023.25, high: 21050.5, low: 21020.25, close: 21047.5 },
      { time: "09:45", open: 21047.5, high: 21074.25, low: 21044.5, close: 21071.25 },
      { time: "09:50", open: 21071.25, high: 21098.75, low: 21068.25, close: 21095.75 },
      // Candle 6 — HH1
      { time: "09:55", open: 21095.75, high: 21120, low: 21092.75, close: 21120 },
      { time: "10:00", open: 21120, high: 21123, low: 21101, close: 21104 },
      { time: "10:05", open: 21104, high: 21107, low: 21085.5, close: 21088.5 },
      { time: "10:10", open: 21088.5, high: 21091.5, low: 21068.5, close: 21071.5 },
      // Candle 10 — HL1
      { time: "10:15", open: 21071.5, high: 21074.5, low: 21055, close: 21055 },
      { time: "10:20", open: 21055, high: 21083.75, low: 21052, close: 21080.75 },
      { time: "10:25", open: 21080.75, high: 21108.25, low: 21077.75, close: 21105.25 },
      { time: "10:30", open: 21105.25, high: 21132.75, low: 21102.25, close: 21129.75 },
      { time: "10:35", open: 21129.75, high: 21157.25, low: 21126.75, close: 21154.25 },
      { time: "10:40", open: 21154.25, high: 21182.25, low: 21151.25, close: 21179.25 },
      // Candle 16 — HH2, the highest point on the chart
      { time: "10:45", open: 21179.25, high: 21205, low: 21176.25, close: 21205 },
      { time: "10:50", open: 21205, high: 21205, low: 21190.25, close: 21193.25 },
      { time: "10:55", open: 21193.25, high: 21196.25, low: 21178, close: 21181 },
      { time: "11:00", open: 21181, high: 21184, low: 21166.75, close: 21169.75 },
      { time: "11:05", open: 21169.75, high: 21172.75, low: 21154.25, close: 21157.25 },
      // Candle 21 — HL2, the higher low whose break confirms the shift (KEY LEVEL 21,145)
      { time: "11:10", open: 21157.25, high: 21160.25, low: 21145, close: 21145 },
      { time: "11:15", open: 21145, high: 21154.75, low: 21145, close: 21151.75 },
      { time: "11:20", open: 21151.75, high: 21161, low: 21148.75, close: 21158 },
      { time: "11:25", open: 21158, high: 21168.25, low: 21155, close: 21165.25 },
      { time: "11:30", open: 21165.25, high: 21175.25, low: 21162.25, close: 21172.25 },
      // Candle 26 — lower high; fails to exceed candle 16's 21,205
      { time: "11:35", open: 21172.25, high: 21178, low: 21169.25, close: 21178 },
      { time: "11:40", open: 21178, high: 21181, low: 21169.75, close: 21172.75 },
      { time: "11:45", open: 21172.75, high: 21175.75, low: 21164.5, close: 21167.5 },
      { time: "11:50", open: 21167.5, high: 21170.5, low: 21159, close: 21162 },
      { time: "11:55", open: 21162, high: 21171, low: 21159, close: 21168 },
      // Candle 31 — displacement candle; body closes at 21,075, well below candle 21's low
      { time: "12:00", open: 21168, high: 21172, low: 21067, close: 21075 },
      { time: "12:05", open: 21075, high: 21078, low: 21057.75, close: 21060.75 },
      { time: "12:10", open: 21060.75, high: 21063.75, low: 21044.75, close: 21047.75 },
      { time: "12:15", open: 21047.75, high: 21050.75, low: 21030.75, close: 21033.75 },
      { time: "12:20", open: 21033.75, high: 21036.75, low: 21017, close: 21020 },
      { time: "12:25", open: 21020, high: 21023, low: 21006.25, close: 21009.25 },
      { time: "12:30", open: 21009.25, high: 21012.25, low: 20997, close: 21000 },
      { time: "12:35", open: 21000, high: 21003, low: 20987.5, close: 20990.5 },
      { time: "12:40", open: 20990.5, high: 20993.5, low: 20977, close: 20980 },
      { time: "12:45", open: 20980, high: 20983, low: 20967, close: 20970 },
    ],
  },
  // mss-002: clear bearish-to-bullish shift — the mirror of mss-001.
  // Downtrend makes LL1 (candle 6, 21,080), LH1 (candle 10, 21,145), LL2
  // (candle 16, 20,995), LH2 (candle 21, 21,055). Candle 26 fails to
  // undercut LL2 (21,022 > 20,995) — a higher low. Candle 31 then closes
  // at 21,135, a clean body close above LH2's 21,055 — the KEY LEVEL.
  // Verified: every high from candle 21 through candle 30 stays at or
  // below 21,055, and 20,995 is the lowest point anywhere in the series.
  {
    exercise_id: "mss-002",
    concept: "MSS",
    answer_type: "level",
    answerLabel: "Market Structure Shift",
    prompt: "Mark the swing level whose break confirmed the Market Structure Shift, if one occurred.",
    noAnswerLabel: "No Market Structure Shift present",
    instrument: "NQ (prototype data)",
    timeframe: "5m",
    difficulty: 1,
    has_answer: true,
    answer: {
      type: "bullish",
      price: 21055,
      tolerance: 6,
    },
    explanation:
      "This is a real Market Structure Shift. Price had been making lower highs and lower lows — a clean downtrend. Then a decline attempt fails to reach a new low, and the next real move is a strong candle that closes well above the most recent lower high. A failed new low, followed by a decisive close above the last lower high, is exactly what confirms a shift from bearish to bullish structure.",
    candles: [
      { time: "09:30", open: 21215, high: 21218, low: 21197, close: 21200 },
      { time: "09:35", open: 21200, high: 21203, low: 21172.5, close: 21175.5 },
      { time: "09:40", open: 21175.5, high: 21178.5, low: 21150, close: 21153 },
      { time: "09:45", open: 21153, high: 21156, low: 21125.75, close: 21128.75 },
      { time: "09:50", open: 21128.75, high: 21131.75, low: 21100.5, close: 21103.5 },
      // Candle 6 — LL1
      { time: "09:55", open: 21103.5, high: 21106.5, low: 21080, close: 21080 },
      { time: "10:00", open: 21080, high: 21100, low: 21077, close: 21097 },
      { time: "10:05", open: 21097, high: 21116.25, low: 21094, close: 21113.25 },
      { time: "10:10", open: 21113.25, high: 21130.75, low: 21110.25, close: 21127.75 },
      // Candle 10 — LH1
      { time: "10:15", open: 21127.75, high: 21145, low: 21124.75, close: 21145 },
      { time: "10:20", open: 21145, high: 21148, low: 21117.5, close: 21120.5 },
      { time: "10:25", open: 21120.5, high: 21123.5, low: 21092.5, close: 21095.5 },
      { time: "10:30", open: 21095.5, high: 21098.5, low: 21066.25, close: 21069.25 },
      { time: "10:35", open: 21069.25, high: 21072.25, low: 21043, close: 21046 },
      { time: "10:40", open: 21046, high: 21049, low: 21017, close: 21020 },
      // Candle 16 — LL2, the lowest point on the chart
      { time: "10:45", open: 21020, high: 21023, low: 20995, close: 20995 },
      { time: "10:50", open: 20995, high: 21010, low: 20995, close: 21007 },
      { time: "10:55", open: 21007, high: 21023, low: 21004, close: 21020 },
      { time: "11:00", open: 21020, high: 21033.25, low: 21017, close: 21030.25 },
      { time: "11:05", open: 21030.25, high: 21045.75, low: 21027.25, close: 21042.75 },
      // Candle 21 — LH2, the lower high whose break confirms the shift (KEY LEVEL 21,055)
      { time: "11:10", open: 21042.75, high: 21055, low: 21039.75, close: 21055 },
      { time: "11:15", open: 21055, high: 21055, low: 21045.75, close: 21048.75 },
      { time: "11:20", open: 21048.75, high: 21051.75, low: 21038, close: 21041 },
      { time: "11:25", open: 21041, high: 21044, low: 21032.75, close: 21035.75 },
      { time: "11:30", open: 21035.75, high: 21038.75, low: 21026, close: 21029 },
      // Candle 26 — higher low; fails to undercut candle 16's 20,995
      { time: "11:35", open: 21029, high: 21032, low: 21022, close: 21022 },
      { time: "11:40", open: 21022, high: 21032.5, low: 21019, close: 21029.5 },
      { time: "11:45", open: 21029.5, high: 21037.75, low: 21026.5, close: 21034.75 },
      { time: "11:50", open: 21034.75, high: 21045, low: 21031.75, close: 21042 },
      { time: "11:55", open: 21042, high: 21045, low: 21035, close: 21038 },
      // Candle 31 — displacement candle; body closes at 21,135, well above candle 21's high
      { time: "12:00", open: 21038, high: 21143, low: 21034, close: 21135 },
      { time: "12:05", open: 21135, high: 21151.25, low: 21132, close: 21148.25 },
      { time: "12:10", open: 21148.25, high: 21165.5, low: 21145.25, close: 21162.5 },
      { time: "12:15", open: 21162.5, high: 21179.25, low: 21159.5, close: 21176.25 },
      { time: "12:20", open: 21176.25, high: 21193, low: 21173.25, close: 21190 },
      { time: "12:25", open: 21190, high: 21202.25, low: 21187, close: 21199.25 },
      { time: "12:30", open: 21199.25, high: 21212, low: 21196.25, close: 21209 },
      { time: "12:35", open: 21209, high: 21222.75, low: 21206, close: 21219.75 },
      { time: "12:40", open: 21219.75, high: 21233.5, low: 21216.75, close: 21230.5 },
      { time: "12:45", open: 21230.5, high: 21243, low: 21227.5, close: 21240 },
    ],
  },
  // mss-003: harder — three legs of higher highs/higher lows instead of
  // two (HH1 candle 5: 21,060; HL1 candle 8: 21,025; HH2 candle 12:
  // 21,095; HL2 candle 15: 21,055; HH3 candle 19: 21,130; HL3 candle 22:
  // 21,085) before candle 26 fails to exceed HH3 (21,110 < 21,130) and
  // candle 31 closes at 21,040, below HL3. The KEY LEVEL is HL3 (21,085)
  // — the most recent higher low, not either of the two earlier ones.
  // Verified: every low from candle 22 through candle 30 stays at or
  // above 21,085, and 21,130 is the highest point anywhere in the series.
  {
    exercise_id: "mss-003",
    concept: "MSS",
    answer_type: "level",
    answerLabel: "Market Structure Shift",
    prompt: "Mark the swing level whose break confirmed the Market Structure Shift, if one occurred.",
    noAnswerLabel: "No Market Structure Shift present",
    instrument: "NQ (prototype data)",
    timeframe: "5m",
    difficulty: 3,
    has_answer: true,
    answer: {
      type: "bearish",
      price: 21085,
      tolerance: 6,
    },
    explanation:
      "This is a real Market Structure Shift, just with more swings to sort through. Price makes three higher lows in a row before the shift, and it's the most recent one — not either of the earlier two — that actually matters. A rally attempt fails to reach a new high, and the next real move is a strong candle that closes well below that most recent higher low. Once price falls that far it passes through the earlier higher lows too, but those aren't what confirms the shift — only the latest one is.",
    candles: [
      { time: "09:30", open: 20985, high: 21003, low: 20982, close: 21000 },
      { time: "09:35", open: 21000, high: 21017.75, low: 20997, close: 21014.75 },
      { time: "09:40", open: 21014.75, high: 21032.25, low: 21011.75, close: 21029.25 },
      // Candle 5 — HH1
      { time: "09:45", open: 21029.25, high: 21049, low: 21026.25, close: 21046 },
      { time: "09:50", open: 21046, high: 21060, low: 21043, close: 21060 },
      { time: "09:55", open: 21060, high: 21063, low: 21045.5, close: 21048.5 },
      { time: "10:00", open: 21048.5, high: 21051.5, low: 21032.75, close: 21035.75 },
      // Candle 8 — HL1
      { time: "10:05", open: 21035.75, high: 21038.75, low: 21025, close: 21025 },
      { time: "10:10", open: 21025, high: 21046, low: 21022, close: 21043 },
      { time: "10:15", open: 21043, high: 21063.5, low: 21040, close: 21060.5 },
      { time: "10:20", open: 21060.5, high: 21079.5, low: 21057.5, close: 21076.5 },
      // Candle 12 — HH2
      { time: "10:25", open: 21076.5, high: 21095, low: 21073.5, close: 21095 },
      { time: "10:30", open: 21095, high: 21098, low: 21079.75, close: 21082.75 },
      { time: "10:35", open: 21082.75, high: 21085.75, low: 21065, close: 21068 },
      // Candle 15 — HL2
      { time: "10:40", open: 21068, high: 21071, low: 21055, close: 21055 },
      { time: "10:45", open: 21055, high: 21078, low: 21052, close: 21075 },
      { time: "10:50", open: 21075, high: 21095.75, low: 21072, close: 21092.75 },
      { time: "10:55", open: 21092.75, high: 21113.25, low: 21089.75, close: 21110.25 },
      // Candle 19 — HH3, the highest point on the chart
      { time: "11:00", open: 21110.25, high: 21130, low: 21107.25, close: 21130 },
      { time: "11:05", open: 21130, high: 21130, low: 21112.75, close: 21115.75 },
      { time: "11:10", open: 21115.75, high: 21118.75, low: 21097, close: 21100 },
      // Candle 22 — HL3, the higher low whose break confirms the shift (KEY LEVEL 21,085)
      { time: "11:15", open: 21100, high: 21103, low: 21085, close: 21085 },
      { time: "11:20", open: 21085, high: 21093.25, low: 21085, close: 21090.25 },
      { time: "11:25", open: 21090.25, high: 21099.75, low: 21087.25, close: 21096.75 },
      { time: "11:30", open: 21096.75, high: 21105.75, low: 21093.75, close: 21102.75 },
      // Candle 26 — lower high; fails to exceed candle 19's 21,130
      { time: "11:35", open: 21102.75, high: 21110, low: 21099.75, close: 21110 },
      { time: "11:40", open: 21110, high: 21113, low: 21101.5, close: 21104.5 },
      { time: "11:45", open: 21104.5, high: 21107.5, low: 21094.25, close: 21097.25 },
      { time: "11:50", open: 21097.25, high: 21100.25, low: 21089, close: 21092 },
      { time: "11:55", open: 21092, high: 21099, low: 21089, close: 21096 },
      // Candle 31 — displacement candle; body closes at 21,040, well below candle 22's low
      { time: "12:00", open: 21096, high: 21100, low: 21032, close: 21040 },
      { time: "12:05", open: 21040, high: 21043, low: 21025.75, close: 21028.75 },
      { time: "12:10", open: 21028.75, high: 21031.75, low: 21015, close: 21018 },
      { time: "12:15", open: 21018, high: 21021, low: 21003.5, close: 21006.5 },
      { time: "12:20", open: 21006.5, high: 21009.5, low: 20992, close: 20995 },
      { time: "12:25", open: 20995, high: 20998, low: 20984, close: 20987 },
      { time: "12:30", open: 20987, high: 20990, low: 20974.75, close: 20977.75 },
      { time: "12:35", open: 20977.75, high: 20980.75, low: 20964, close: 20967 },
      { time: "12:40", open: 20967, high: 20970, low: 20955.75, close: 20958.75 },
      { time: "12:45", open: 20958.75, high: 20961.75, low: 20947, close: 20950 },
    ],
  },
  // mss-004: has_answer is false. A pure uptrend that never shifts — every
  // high (candle 5: 21,060; candle 15: 21,112; candle 24: 21,150; candle
  // 33: 21,190) is higher than the last, and every low (candle 9: 21,030;
  // candle 19: 21,080; candle 28: 21,105) is higher than the last, all the
  // way to the end of the chart. Candle 15 is the deliberate distractor:
  // it closes decisively above candle 5's high, which looks like a
  // significant break — but it's a break in the *same* direction as the
  // trend (continuation), not against it, so it isn't an MSS. Verified:
  // no candle's low ever closes below the prior higher low anywhere in
  // the series (checked window by window between each pair of swing lows).
  {
    exercise_id: "mss-004",
    concept: "MSS",
    answer_type: "level",
    answerLabel: "Market Structure Shift",
    prompt: "Mark the swing level whose break confirmed the Market Structure Shift, if one occurred.",
    noAnswerLabel: "No Market Structure Shift present",
    instrument: "NQ (prototype data)",
    timeframe: "5m",
    difficulty: 2,
    has_answer: false,
    answer: null,
    explanation:
      "Partway through, a candle closes decisively above the earlier high — that can look like a big deal, but it's just the uptrend continuing, not reversing. A real Market Structure Shift needs a break against the trend: a failed attempt at a new high, followed by a close below the most recent higher low. That never happens here. Every high on this chart is higher than the one before it, and every low is higher than the one before it, all the way to the end.",
    distractor_note:
      "Partway through, a candle closes decisively above the earlier high — that can look like a big deal, but it's just the uptrend continuing, not reversing. A real Market Structure Shift needs a break against the trend: a failed attempt at a new high, followed by a close below the most recent higher low. That never happens here. Every high on this chart is higher than the one before it, and every low is higher than the one before it, all the way to the end.",
    candles: [
      { time: "09:30", open: 20985, high: 21003, low: 20982, close: 21000 },
      { time: "09:35", open: 21000, high: 21018.75, low: 20997, close: 21015.75 },
      { time: "09:40", open: 21015.75, high: 21033.25, low: 21012.75, close: 21030.25 },
      { time: "09:45", open: 21030.25, high: 21047.25, low: 21027.25, close: 21044.25 },
      // Candle 5 — HH1
      { time: "09:50", open: 21044.25, high: 21060, low: 21041.25, close: 21060 },
      { time: "09:55", open: 21060, high: 21063, low: 21048.5, close: 21051.5 },
      { time: "10:00", open: 21051.5, high: 21054.5, low: 21041.75, close: 21044.75 },
      { time: "10:05", open: 21044.75, high: 21047.75, low: 21034.5, close: 21037.5 },
      // Candle 9 — HL1
      { time: "10:10", open: 21037.5, high: 21040.5, low: 21030, close: 21030 },
      { time: "10:15", open: 21030, high: 21037, low: 21030, close: 21034 },
      { time: "10:20", open: 21034, high: 21043, low: 21031, close: 21040 },
      { time: "10:25", open: 21040, high: 21046, low: 21037, close: 21043 },
      { time: "10:30", open: 21043, high: 21051, low: 21040, close: 21048 },
      { time: "10:35", open: 21048, high: 21061, low: 21045, close: 21058 },
      // Candle 15 — closes above candle 5's high; the uptrend continuing, not a shift
      { time: "10:40", open: 21058, high: 21112, low: 21055, close: 21112 },
      { time: "10:45", open: 21112, high: 21112, low: 21100, close: 21103 },
      { time: "10:50", open: 21103, high: 21106, low: 21093.25, close: 21096.25 },
      { time: "10:55", open: 21096.25, high: 21099.25, low: 21085.25, close: 21088.25 },
      // Candle 19 — HL2, higher than candle 9's HL1
      { time: "11:00", open: 21088.25, high: 21091.25, low: 21080, close: 21080 },
      { time: "11:05", open: 21080, high: 21097.75, low: 21080, close: 21094.75 },
      { time: "11:10", open: 21094.75, high: 21109.75, low: 21091.75, close: 21106.75 },
      { time: "11:15", open: 21106.75, high: 21124, low: 21103.75, close: 21121 },
      { time: "11:20", open: 21121, high: 21138.5, low: 21118, close: 21135.5 },
      // Candle 24 — HH3, another new high
      { time: "11:25", open: 21135.5, high: 21150, low: 21132.5, close: 21150 },
      { time: "11:30", open: 21150, high: 21153, low: 21137, close: 21140 },
      { time: "11:35", open: 21140, high: 21143, low: 21124.75, close: 21127.75 },
      { time: "11:40", open: 21127.75, high: 21130.75, low: 21112.5, close: 21115.5 },
      // Candle 28 — HL3, higher than candle 19's HL2
      { time: "11:45", open: 21115.5, high: 21118.5, low: 21105, close: 21105 },
      { time: "11:50", open: 21105, high: 21125.25, low: 21105, close: 21122.25 },
      { time: "11:55", open: 21122.25, high: 21141, low: 21119.25, close: 21138 },
      { time: "12:00", open: 21138, high: 21158.75, low: 21135, close: 21155.75 },
      { time: "12:05", open: 21155.75, high: 21176.5, low: 21152.75, close: 21173.5 },
      // Candle 33 — HH4, still no shift anywhere on this chart
      { time: "12:10", open: 21173.5, high: 21190, low: 21170.5, close: 21190 },
      { time: "12:15", open: 21190, high: 21193, low: 21177.75, close: 21180.75 },
      { time: "12:20", open: 21180.75, high: 21183.75, low: 21168, close: 21171 },
      { time: "12:25", open: 21171, high: 21174, low: 21157.5, close: 21160.5 },
      { time: "12:30", open: 21160.5, high: 21163.5, low: 21147, close: 21150 },
      { time: "12:35", open: 21150, high: 21159, low: 21147, close: 21156 },
      { time: "12:40", open: 21156, high: 21162.5, low: 21153, close: 21159.5 },
      { time: "12:45", open: 21159.5, high: 21168, low: 21156.5, close: 21165 },
    ],
  },
  // mss-005: has_answer is true — a real MSS exists, but a wick-only false
  // break sits earlier on the same level as a decoy. Uptrend makes HH1
  // (candle 5, 21,070), HL1 (candle 9, 21,035), HH2 (candle 14, 21,130),
  // HL2 (candle 18, 21,085 — the KEY LEVEL). Candle 22 fails to exceed HH2
  // (21,118 < 21,130). Candle 26's wick dips to 21,058 — well below HL2 —
  // but its body closes back at 21,096, above the level: a wick-only
  // break, per docs/CURRICULUM.md not confirmation. The real break is
  // candle 34, which closes at 21,035, well below HL2. Verified: every
  // low from candle 18 through candle 33 stays at or above 21,085 *except*
  // candle 26's wick (its body stays above 21,085), and 21,130 is the
  // highest point anywhere in the series.
  {
    exercise_id: "mss-005",
    concept: "MSS",
    answer_type: "level",
    answerLabel: "Market Structure Shift",
    prompt: "Mark the swing level whose break confirmed the Market Structure Shift, if one occurred.",
    noAnswerLabel: "No Market Structure Shift present",
    instrument: "NQ (prototype data)",
    timeframe: "5m",
    difficulty: 2,
    has_answer: true,
    answer: {
      type: "bearish",
      price: 21085,
      tolerance: 6,
    },
    explanation:
      "This is a real Market Structure Shift, but there's a false alarm first. Price dips well below the most recent higher low — but only as a thin wick, a quick poke that doesn't stick. The solid part of that same candle, its body, closes back above the level, so nothing is confirmed yet. A wick alone isn't enough; the candle's body has to close beyond the level for real. The actual shift comes later, when a candle's body does close below that same higher low and price keeps falling from there.",
    candles: [
      { time: "09:30", open: 20985, high: 21003, low: 20982, close: 21000 },
      { time: "09:35", open: 21000, high: 21020.75, low: 20997, close: 21017.75 },
      { time: "09:40", open: 21017.75, high: 21038, low: 21014.75, close: 21035 },
      { time: "09:45", open: 21035, high: 21056, low: 21032, close: 21053 },
      // Candle 5 — HH1
      { time: "09:50", open: 21053, high: 21070, low: 21050, close: 21070 },
      { time: "09:55", open: 21070, high: 21073, low: 21059.5, close: 21062.5 },
      { time: "10:00", open: 21062.5, high: 21065.5, low: 21050.25, close: 21053.25 },
      { time: "10:05", open: 21053.25, high: 21056.25, low: 21039.75, close: 21042.75 },
      // Candle 9 — HL1
      { time: "10:10", open: 21042.75, high: 21045.75, low: 21035, close: 21035 },
      { time: "10:15", open: 21035, high: 21056.5, low: 21032, close: 21053.5 },
      { time: "10:20", open: 21053.5, high: 21076.75, low: 21050.5, close: 21073.75 },
      { time: "10:25", open: 21073.75, high: 21095, low: 21070.75, close: 21092 },
      { time: "10:30", open: 21092, high: 21114.75, low: 21089, close: 21111.75 },
      // Candle 14 — HH2, the highest point on the chart
      { time: "10:35", open: 21111.75, high: 21130, low: 21108.75, close: 21130 },
      { time: "10:40", open: 21130, high: 21130, low: 21116.75, close: 21119.75 },
      { time: "10:45", open: 21119.75, high: 21122.75, low: 21104.25, close: 21107.25 },
      // Candle 18 — HL2, the higher low whose break confirms the shift (KEY LEVEL 21,085)
      { time: "10:50", open: 21107.25, high: 21110.25, low: 21094.25, close: 21097.25 },
      { time: "10:55", open: 21097.25, high: 21100.25, low: 21085, close: 21085 },
      { time: "11:00", open: 21085, high: 21097, low: 21085, close: 21094 },
      { time: "11:05", open: 21094, high: 21104.75, low: 21091, close: 21101.75 },
      { time: "11:10", open: 21101.75, high: 21113.25, low: 21098.75, close: 21110.25 },
      // Candle 22 — lower high; fails to exceed candle 14's 21,130
      { time: "11:15", open: 21110.25, high: 21118, low: 21107.25, close: 21118 },
      { time: "11:20", open: 21118, high: 21121, low: 21108.5, close: 21111.5 },
      { time: "11:25", open: 21111.5, high: 21114.5, low: 21104.75, close: 21107.75 },
      { time: "11:30", open: 21107.75, high: 21110.75, low: 21098.25, close: 21101.25 },
      // Candle 26 — wick to 21,058, well below HL2, but the body closes at 21,096, above it — wick-only, doesn't qualify
      { time: "11:35", open: 21101.25, high: 21104.25, low: 21058, close: 21096 },
      { time: "11:40", open: 21096, high: 21102, low: 21093, close: 21099 },
      { time: "11:45", open: 21099, high: 21103.75, low: 21096, close: 21100.75 },
      { time: "11:50", open: 21100.75, high: 21107.25, low: 21097.75, close: 21104.25 },
      { time: "11:55", open: 21104.25, high: 21111, low: 21101.25, close: 21108 },
      { time: "12:00", open: 21108, high: 21111, low: 21101.25, close: 21104.25 },
      { time: "12:05", open: 21104.25, high: 21107.25, low: 21100.5, close: 21103.5 },
      { time: "12:10", open: 21103.5, high: 21106.5, low: 21097, close: 21100 },
      // Candle 34 — displacement candle; body closes at 21,035, well below candle 18's low — the real break
      { time: "12:15", open: 21100, high: 21104, low: 21027, close: 21035 },
      { time: "12:20", open: 21035, high: 21038, low: 21021.75, close: 21024.75 },
      { time: "12:25", open: 21024.75, high: 21027.75, low: 21012.75, close: 21015.75 },
      { time: "12:30", open: 21015.75, high: 21018.75, low: 21002.5, close: 21005.5 },
      { time: "12:35", open: 21005.5, high: 21008.5, low: 20992, close: 20995 },
      { time: "12:40", open: 20995, high: 20998, low: 20978.5, close: 20981.5 },
      { time: "12:45", open: 20981.5, high: 20984.5, low: 20967, close: 20970 },
    ],
  },
  // fvg-resp-001: clearly respected (bullish). The FVG at candles 9-11
  // (21,065-21,105) forms, price rallies away, then pulls back — candle 28
  // wicks into the gap and candle 29 closes back above it, confirming a
  // reaction. Verified: no candle between the gap and the return (12-27)
  // dips back into the zone.
  {
    exercise_id: "fvg-resp-001",
    concept: "FVG",
    answer_type: "choice",
    answerLabel: "Respected vs. Disrespected",
    prompt:
      "This chart shows a Fair Value Gap (shaded) and the price action after it. Was the gap respected or disrespected?",
    options: [
      { value: "respected", label: "Respected" },
      { value: "disrespected", label: "Disrespected" },
    ],
    instrument: "NQ (prototype data)",
    timeframe: "5m",
    difficulty: 1,
    answer: {
      correct_choice: "respected",
      fvg_zone: { price_low: 21065, price_high: 21105, candle_start: 8, candle_end: 10 },
    },
    explanation:
      "This Fair Value Gap was respected. This project decides respected vs. disrespected by candle body closes, not wicks — a wick trading into the gap doesn't invalidate it. Candle 28's wick reaches down to 21075, inside the gap, but its body closes at 21095 — still above the gap's lower boundary at 21065. No candle body ever closes below 21065, so the gap holds and price continues higher.",
    candles: [
      { time: "09:30", open: 20985, high: 21003.5, low: 20981.5, close: 21000 },
      { time: "09:35", open: 21000, high: 21010.5, low: 20996.5, close: 21007 },
      { time: "09:40", open: 21007, high: 21020, low: 21003.5, close: 21016.5 },
      { time: "09:45", open: 21016.5, high: 21024.75, low: 21013, close: 21021.25 },
      { time: "09:50", open: 21021.25, high: 21033.5, low: 21017.75, close: 21030 },
      { time: "09:55", open: 21030, high: 21040.5, low: 21026.5, close: 21037 },
      { time: "10:00", open: 21037, high: 21047, low: 21033.5, close: 21043.5 },
      { time: "10:05", open: 21043.5, high: 21054.5, low: 21040, close: 21051 },
      // Candle 9 — candle 1 of the FVG
      { time: "10:10", open: 21051, high: 21065, low: 21047.5, close: 21058 },
      // Candle 10 — expansion candle
      { time: "10:15", open: 21058, high: 21149, low: 21054.5, close: 21145 },
      // Candle 11 — candle 3, confirms the gap (21,065-21,105)
      { time: "10:20", open: 21145, high: 21163.5, low: 21105, close: 21160 },
      { time: "10:25", open: 21160, high: 21178.5, low: 21156.5, close: 21175 },
      { time: "10:30", open: 21175, high: 21190.5, low: 21171.5, close: 21187 },
      { time: "10:35", open: 21187, high: 21206.5, low: 21183.5, close: 21203 },
      { time: "10:40", open: 21203, high: 21218.5, low: 21199.5, close: 21215 },
      { time: "10:45", open: 21215, high: 21233.5, low: 21211.5, close: 21230 },
      { time: "10:50", open: 21230, high: 21239.75, low: 21226.5, close: 21236.25 },
      { time: "10:55", open: 21236.25, high: 21248.75, low: 21232.75, close: 21245.25 },
      { time: "11:00", open: 21245.25, high: 21256.75, low: 21241.75, close: 21253.25 },
      { time: "11:05", open: 21253.25, high: 21263.5, low: 21249.75, close: 21260 },
      { time: "11:10", open: 21260, high: 21263.5, low: 21237, close: 21240.5 },
      { time: "11:15", open: 21240.5, high: 21244, low: 21215.75, close: 21219.25 },
      { time: "11:20", open: 21219.25, high: 21222.75, low: 21197.5, close: 21201 },
      { time: "11:25", open: 21201, high: 21204.5, low: 21176.5, close: 21180 },
      { time: "11:30", open: 21180, high: 21183.5, low: 21155.25, close: 21158.75 },
      { time: "11:35", open: 21158.75, high: 21162.25, low: 21132, close: 21135.5 },
      { time: "11:40", open: 21135.5, high: 21139, low: 21111.5, close: 21115 },
      // Candle 28 — price returns, wicks into the gap, closes back inside it near the top
      { time: "11:45", open: 21115, high: 21118, low: 21075, close: 21095 },
      // Candle 29 — reverses back up and out the top of the gap — RESPECTED
      { time: "11:50", open: 21095, high: 21128.5, low: 21091.5, close: 21125 },
      { time: "11:55", open: 21125, high: 21141.5, low: 21121.5, close: 21138 },
      { time: "12:00", open: 21138, high: 21154.25, low: 21134.5, close: 21150.75 },
      { time: "12:05", open: 21150.75, high: 21164.5, low: 21147.25, close: 21161 },
      { time: "12:10", open: 21161, high: 21179.75, low: 21157.5, close: 21176.25 },
      { time: "12:15", open: 21176.25, high: 21190.75, low: 21172.75, close: 21187.25 },
      { time: "12:20", open: 21187.25, high: 21203.5, low: 21183.75, close: 21200 },
      { time: "12:25", open: 21200, high: 21212.25, low: 21196.5, close: 21208.75 },
      { time: "12:30", open: 21208.75, high: 21220.5, low: 21205.25, close: 21217 },
      { time: "12:35", open: 21217, high: 21227.5, low: 21213.5, close: 21224 },
      { time: "12:40", open: 21224, high: 21236.75, low: 21220.5, close: 21233.25 },
      { time: "12:45", open: 21233.25, high: 21243.5, low: 21229.75, close: 21240 },
    ],
  },
  // fvg-resp-002: clearly respected (bearish) — the mirror of fvg-resp-001.
  // The FVG at candles 9-11 (21,080-21,120) forms, price falls away, then
  // rallies back — candle 28 wicks into the gap and candle 29 closes back
  // below it, confirming a reaction. Verified: no candle between the gap
  // and the return (12-27) rallies back into the zone.
  {
    exercise_id: "fvg-resp-002",
    concept: "FVG",
    answer_type: "choice",
    answerLabel: "Respected vs. Disrespected",
    prompt:
      "This chart shows a Fair Value Gap (shaded) and the price action after it. Was the gap respected or disrespected?",
    options: [
      { value: "respected", label: "Respected" },
      { value: "disrespected", label: "Disrespected" },
    ],
    instrument: "NQ (prototype data)",
    timeframe: "5m",
    difficulty: 1,
    answer: {
      correct_choice: "respected",
      fvg_zone: { price_low: 21080, price_high: 21120, candle_start: 8, candle_end: 10 },
    },
    explanation:
      "This Fair Value Gap was respected. Respected vs. disrespected comes down to candle body closes, not wicks — a wick trading into the gap doesn't invalidate it. Candle 28's wick reaches up to 21110, inside the gap, but its body closes at 21100 — still below the gap's upper boundary at 21120. No candle body ever closes above 21120, so the gap holds and price continues lower.",
    candles: [
      { time: "09:30", open: 21215, high: 21218.5, low: 21196.5, close: 21200 },
      { time: "09:35", open: 21200, high: 21203.5, low: 21189, close: 21192.5 },
      { time: "09:40", open: 21192.5, high: 21196, low: 21180, close: 21183.5 },
      { time: "09:45", open: 21183.5, high: 21187, low: 21173, close: 21176.5 },
      { time: "09:50", open: 21176.5, high: 21180, low: 21166.5, close: 21170 },
      { time: "09:55", open: 21170, high: 21173.5, low: 21160.5, close: 21164 },
      { time: "10:00", open: 21164, high: 21167.5, low: 21152.75, close: 21156.25 },
      { time: "10:05", open: 21156.25, high: 21159.75, low: 21142.75, close: 21146.25 },
      // Candle 9 — candle 1 of the FVG
      { time: "10:10", open: 21146.25, high: 21149.75, low: 21120, close: 21140 },
      // Candle 10 — expansion candle
      { time: "10:15", open: 21140, high: 21143.5, low: 21051, close: 21055 },
      // Candle 11 — candle 3, confirms the gap (21,080-21,120)
      { time: "10:20", open: 21055, high: 21080, low: 21036.5, close: 21040 },
      { time: "10:25", open: 21040, high: 21043.5, low: 21026.5, close: 21030 },
      { time: "10:30", open: 21030, high: 21033.5, low: 21014.25, close: 21017.75 },
      { time: "10:35", open: 21017.75, high: 21021.25, low: 21002.5, close: 21006 },
      { time: "10:40", open: 21006, high: 21009.5, low: 20991.5, close: 20995 },
      { time: "10:45", open: 20995, high: 20998.5, low: 20981.5, close: 20985 },
      { time: "10:50", open: 20985, high: 20988.5, low: 20973.5, close: 20977 },
      { time: "10:55", open: 20977, high: 20980.5, low: 20967.25, close: 20970.75 },
      { time: "11:00", open: 20970.75, high: 20974.25, low: 20958.75, close: 20962.25 },
      { time: "11:05", open: 20962.25, high: 20965.75, low: 20951.5, close: 20955 },
      { time: "11:10", open: 20955, high: 20973.25, low: 20951.5, close: 20969.75 },
      { time: "11:15", open: 20969.75, high: 20989.25, low: 20966.25, close: 20985.75 },
      { time: "11:20", open: 20985.75, high: 21004, low: 20982.25, close: 21000.5 },
      { time: "11:25", open: 21000.5, high: 21018.5, low: 20997, close: 21015 },
      { time: "11:30", open: 21015, high: 21038.5, low: 21011.5, close: 21035 },
      { time: "11:35", open: 21035, high: 21058.5, low: 21031.5, close: 21055 },
      { time: "11:40", open: 21055, high: 21078.5, low: 21051.5, close: 21075 },
      // Candle 28 — price returns, wicks into the gap, closes back inside it near the bottom
      { time: "11:45", open: 21075, high: 21110, low: 21072, close: 21100 },
      // Candle 29 — reverses back down and out the bottom of the gap — RESPECTED
      { time: "11:50", open: 21100, high: 21103.5, low: 21056.5, close: 21060 },
      { time: "11:55", open: 21060, high: 21063.5, low: 21046.25, close: 21049.75 },
      { time: "12:00", open: 21049.75, high: 21053.25, low: 21033, close: 21036.5 },
      { time: "12:05", open: 21036.5, high: 21040, low: 21022.25, close: 21025.75 },
      { time: "12:10", open: 21025.75, high: 21029.25, low: 21009.75, close: 21013.25 },
      { time: "12:15", open: 21013.25, high: 21016.75, low: 20999.5, close: 21003 },
      { time: "12:20", open: 21003, high: 21006.5, low: 20986.5, close: 20990 },
      { time: "12:25", open: 20990, high: 20993.5, low: 20978.25, close: 20981.75 },
      { time: "12:30", open: 20981.75, high: 20985.25, low: 20970.5, close: 20974 },
      { time: "12:35", open: 20974, high: 20977.5, low: 20962.5, close: 20966 },
      { time: "12:40", open: 20966, high: 20969.5, low: 20954.75, close: 20958.25 },
      { time: "12:45", open: 20958.25, high: 20961.75, low: 20946.5, close: 20950 },
    ],
  },
  // fvg-resp-003: clearly disrespected (bullish). The same gap shape as
  // fvg-resp-001 (21,065-21,105), but the later decline doesn't react —
  // candle 28 opens above the zone and closes below it in a single candle,
  // continuing lower with no reversal. Verified: no candle between the gap
  // and the break (12-27) dips back into the zone before candle 28.
  {
    exercise_id: "fvg-resp-003",
    concept: "FVG",
    answer_type: "choice",
    answerLabel: "Respected vs. Disrespected",
    prompt:
      "This chart shows a Fair Value Gap (shaded) and the price action after it. Was the gap respected or disrespected?",
    options: [
      { value: "respected", label: "Respected" },
      { value: "disrespected", label: "Disrespected" },
    ],
    instrument: "NQ (prototype data)",
    timeframe: "5m",
    difficulty: 2,
    answer: {
      correct_choice: "disrespected",
      fvg_zone: { price_low: 21065, price_high: 21105, candle_start: 8, candle_end: 10 },
    },
    explanation:
      "This Fair Value Gap was disrespected. A gap is disrespected the moment a candle body closes beyond its far boundary — wicks don't count, only body closes do. Candle 28 opens above the entire gap and its body closes at 21050, below the gap's lower boundary at 21065, with no earlier candle having closed inside or beyond it first. That single body close through the far side disrespects the gap, and price keeps falling from there.",
    candles: [
      { time: "09:30", open: 20985, high: 21003.5, low: 20981.5, close: 21000 },
      { time: "09:35", open: 21000, high: 21011.75, low: 20996.5, close: 21008.25 },
      { time: "09:40", open: 21008.25, high: 21018, low: 21004.75, close: 21014.5 },
      { time: "09:45", open: 21014.5, high: 21026.5, low: 21011, close: 21023 },
      { time: "09:50", open: 21023, high: 21033.5, low: 21019.5, close: 21030 },
      { time: "09:55", open: 21030, high: 21039.25, low: 21026.5, close: 21035.75 },
      { time: "10:00", open: 21035.75, high: 21047.25, low: 21032.25, close: 21043.75 },
      { time: "10:05", open: 21043.75, high: 21055.5, low: 21040.25, close: 21052 },
      // Candle 9 — candle 1 of the FVG
      { time: "10:10", open: 21052, high: 21065, low: 21048.5, close: 21058 },
      // Candle 10 — expansion candle
      { time: "10:15", open: 21058, high: 21149, low: 21054.5, close: 21145 },
      // Candle 11 — candle 3, confirms the gap (21,065-21,105)
      { time: "10:20", open: 21145, high: 21163.5, low: 21105, close: 21160 },
      { time: "10:25", open: 21160, high: 21172.5, low: 21156.5, close: 21169 },
      { time: "10:30", open: 21169, high: 21180.75, low: 21165.5, close: 21177.25 },
      { time: "10:35", open: 21177.25, high: 21186.75, low: 21173.75, close: 21183.25 },
      { time: "10:40", open: 21183.25, high: 21195.25, low: 21179.75, close: 21191.75 },
      { time: "10:45", open: 21191.75, high: 21203.5, low: 21188.25, close: 21200 },
      { time: "10:50", open: 21200, high: 21203.5, low: 21192.75, close: 21196.25 },
      { time: "10:55", open: 21196.25, high: 21199.75, low: 21192, close: 21195.5 },
      { time: "11:00", open: 21195.5, high: 21199, low: 21189.5, close: 21193 },
      { time: "11:05", open: 21193, high: 21196.5, low: 21186.5, close: 21190 },
      { time: "11:10", open: 21190, high: 21193.5, low: 21173.75, close: 21177.25 },
      { time: "11:15", open: 21177.25, high: 21180.75, low: 21162.25, close: 21165.75 },
      { time: "11:20", open: 21165.75, high: 21169.25, low: 21149.5, close: 21153 },
      { time: "11:25", open: 21153, high: 21156.5, low: 21136.5, close: 21140 },
      { time: "11:30", open: 21140, high: 21143.5, low: 21131.25, close: 21134.75 },
      { time: "11:35", open: 21134.75, high: 21138.25, low: 21121.75, close: 21125.25 },
      // Candle 27 — still above the gap
      { time: "11:40", open: 21125.25, high: 21128.75, low: 21116.5, close: 21120 },
      // Candle 28 — trades straight through the entire gap and closes below it — DISRESPECTED
      { time: "11:45", open: 21120, high: 21122, low: 21044, close: 21050 },
      { time: "11:50", open: 21050, high: 21053.5, low: 21016.5, close: 21020 },
      { time: "11:55", open: 21020, high: 21023.5, low: 21007.75, close: 21011.25 },
      { time: "12:00", open: 21011.25, high: 21014.75, low: 20997.75, close: 21001.25 },
      { time: "12:05", open: 21001.25, high: 21004.75, low: 20987.75, close: 20991.25 },
      { time: "12:10", open: 20991.25, high: 20994.75, low: 20975.5, close: 20979 },
      { time: "12:15", open: 20979, high: 20982.5, low: 20965.75, close: 20969.25 },
      { time: "12:20", open: 20969.25, high: 20972.75, low: 20956.5, close: 20960 },
      { time: "12:25", open: 20960, high: 20963.5, low: 20947.25, close: 20950.75 },
      { time: "12:30", open: 20950.75, high: 20954.25, low: 20941.75, close: 20945.25 },
      { time: "12:35", open: 20945.25, high: 20948.75, low: 20932.5, close: 20936 },
      { time: "12:40", open: 20936, high: 20939.5, low: 20925.75, close: 20929.25 },
      { time: "12:45", open: 20929.25, high: 20932.75, low: 20916.5, close: 20920 },
    ],
  },
  // fvg-resp-004: clearly disrespected (bearish) — the mirror of
  // fvg-resp-003. The gap at 21,080-21,120, but the later rally doesn't
  // react — candle 28 opens below the zone and closes above it in a
  // single candle, continuing higher with no reversal. Verified: no
  // candle between the gap and the break (12-27) rallies back into the
  // zone before candle 28.
  {
    exercise_id: "fvg-resp-004",
    concept: "FVG",
    answer_type: "choice",
    answerLabel: "Respected vs. Disrespected",
    prompt:
      "This chart shows a Fair Value Gap (shaded) and the price action after it. Was the gap respected or disrespected?",
    options: [
      { value: "respected", label: "Respected" },
      { value: "disrespected", label: "Disrespected" },
    ],
    instrument: "NQ (prototype data)",
    timeframe: "5m",
    difficulty: 2,
    answer: {
      correct_choice: "disrespected",
      fvg_zone: { price_low: 21080, price_high: 21120, candle_start: 8, candle_end: 10 },
    },
    explanation:
      "This Fair Value Gap was disrespected. A gap is disrespected the moment a candle body closes beyond its far boundary — wicks don't count, only body closes do. Candle 28 opens below the entire gap and its body closes at 21150, above the gap's upper boundary at 21120, with no earlier candle having reacted from inside the zone first. That single body close through the far side disrespects the gap, and price keeps rising from there.",
    candles: [
      { time: "09:30", open: 21215, high: 21218.5, low: 21196.5, close: 21200 },
      { time: "09:35", open: 21200, high: 21203.5, low: 21188.5, close: 21192 },
      { time: "09:40", open: 21192, high: 21195.5, low: 21180.5, close: 21184 },
      { time: "09:45", open: 21184, high: 21187.5, low: 21175.25, close: 21178.75 },
      { time: "09:50", open: 21178.75, high: 21182.25, low: 21166.5, close: 21170 },
      { time: "09:55", open: 21170, high: 21173.5, low: 21157.5, close: 21161 },
      { time: "10:00", open: 21161, high: 21164.5, low: 21152.25, close: 21155.75 },
      { time: "10:05", open: 21155.75, high: 21159.25, low: 21144.5, close: 21148 },
      // Candle 9 — candle 1 of the FVG
      { time: "10:10", open: 21148, high: 21151.5, low: 21120, close: 21140 },
      // Candle 10 — expansion candle
      { time: "10:15", open: 21140, high: 21143.5, low: 21051, close: 21055 },
      // Candle 11 — candle 3, confirms the gap (21,080-21,120)
      { time: "10:20", open: 21055, high: 21080, low: 21036.5, close: 21040 },
      { time: "10:25", open: 21040, high: 21043.5, low: 21026.5, close: 21030 },
      { time: "10:30", open: 21030, high: 21033.5, low: 21013.25, close: 21016.75 },
      { time: "10:35", open: 21016.75, high: 21020.25, low: 21004.25, close: 21007.75 },
      { time: "10:40", open: 21007.75, high: 21011.25, low: 20991.25, close: 20994.75 },
      { time: "10:45", open: 20994.75, high: 20998.25, low: 20981.5, close: 20985 },
      { time: "10:50", open: 20985, high: 20988.5, low: 20973.25, close: 20976.75 },
      { time: "10:55", open: 20976.75, high: 20980.25, low: 20965.5, close: 20969 },
      { time: "11:00", open: 20969, high: 20972.5, low: 20959.75, close: 20963.25 },
      { time: "11:05", open: 20963.25, high: 20966.75, low: 20951.5, close: 20955 },
      { time: "11:10", open: 20955, high: 20973.75, low: 20951.5, close: 20970.25 },
      { time: "11:15", open: 20970.25, high: 20989.25, low: 20966.75, close: 20985.75 },
      { time: "11:20", open: 20985.75, high: 21004.75, low: 20982.25, close: 21001.25 },
      { time: "11:25", open: 21001.25, high: 21018.5, low: 20997.75, close: 21015 },
      { time: "11:30", open: 21015, high: 21028.75, low: 21011.5, close: 21025.25 },
      { time: "11:35", open: 21025.25, high: 21040.5, low: 21021.75, close: 21037 },
      // Candle 27 — still below the gap
      { time: "11:40", open: 21037, high: 21053.5, low: 21033.5, close: 21050 },
      // Candle 28 — trades straight through the entire gap and closes above it — DISRESPECTED
      { time: "11:45", open: 21050, high: 21156, low: 21048, close: 21150 },
      { time: "11:50", open: 21150, high: 21183.5, low: 21146.5, close: 21180 },
      { time: "11:55", open: 21180, high: 21192, low: 21176.5, close: 21188.5 },
      { time: "12:00", open: 21188.5, high: 21199.5, low: 21185, close: 21196 },
      { time: "12:05", open: 21196, high: 21209.5, low: 21192.5, close: 21206 },
      { time: "12:10", open: 21206, high: 21217.75, low: 21202.5, close: 21214.25 },
      { time: "12:15", open: 21214.25, high: 21224, low: 21210.75, close: 21220.5 },
      { time: "12:20", open: 21220.5, high: 21233.5, low: 21217, close: 21230 },
      { time: "12:25", open: 21230, high: 21240.5, low: 21226.5, close: 21237 },
      { time: "12:30", open: 21237, high: 21245.25, low: 21233.5, close: 21241.75 },
      { time: "12:35", open: 21241.75, high: 21252, low: 21238.25, close: 21248.5 },
      { time: "12:40", open: 21248.5, high: 21256.5, low: 21245, close: 21253 },
      { time: "12:45", open: 21253, high: 21263.5, low: 21249.5, close: 21260 },
    ],
  },
  // fvg-resp-005: harder / ambiguous. The gap at 21,065-21,105, but this
  // time price returns and spends two candles chopping inside the zone
  // (candles 28-29) before a third candle (30) closes through the bottom
  // and continues — DISRESPECTED, despite the pause. Teaches that a pause
  // inside the gap isn't itself a reaction; what matters is whether price
  // leaves the zone by reversing back out or by closing through it.
  {
    exercise_id: "fvg-resp-005",
    concept: "FVG",
    answer_type: "choice",
    answerLabel: "Respected vs. Disrespected",
    prompt:
      "This chart shows a Fair Value Gap (shaded) and the price action after it. Was the gap respected or disrespected?",
    options: [
      { value: "respected", label: "Respected" },
      { value: "disrespected", label: "Disrespected" },
    ],
    instrument: "NQ (prototype data)",
    timeframe: "5m",
    difficulty: 3,
    answer: {
      correct_choice: "disrespected",
      fvg_zone: { price_low: 21065, price_high: 21105, candle_start: 8, candle_end: 10 },
    },
    explanation:
      "This Fair Value Gap was disrespected, even though it doesn't look that way at first. Price re-enters the gap on candle 28 and chops there for a candle, which can look like a reaction — but neither candle's body closes beyond the gap's lower boundary at 21065, so nothing is decided yet. Candle 30 then closes at 21040, below that boundary, and price keeps falling. That body close is what makes the gap disrespected — the pause beforehand doesn't matter, and neither would a wick that dipped low without a body close to match.",
    candles: [
      { time: "09:30", open: 20985, high: 21003, low: 20982, close: 21000 },
      { time: "09:35", open: 21000, high: 21010, low: 20997, close: 21007 },
      { time: "09:40", open: 21007, high: 21017.75, low: 21004, close: 21014.75 },
      { time: "09:45", open: 21014.75, high: 21025.5, low: 21011.75, close: 21022.5 },
      { time: "09:50", open: 21022.5, high: 21033, low: 21019.5, close: 21030 },
      { time: "09:55", open: 21030, high: 21041, low: 21027, close: 21038 },
      { time: "10:00", open: 21038, high: 21048, low: 21035, close: 21045 },
      { time: "10:05", open: 21045, high: 21054.75, low: 21042, close: 21051.75 },
      // Candle 9 — candle 1 of the FVG
      { time: "10:10", open: 21051.75, high: 21065, low: 21048.75, close: 21058 },
      // Candle 10 — expansion candle
      { time: "10:15", open: 21058, high: 21149, low: 21054.5, close: 21145 },
      // Candle 11 — candle 3, confirms the gap (21,065-21,105)
      { time: "10:20", open: 21145, high: 21163, low: 21105, close: 21160 },
      { time: "10:25", open: 21160, high: 21172, low: 21157, close: 21169 },
      { time: "10:30", open: 21169, high: 21183.75, low: 21166, close: 21180.75 },
      { time: "10:35", open: 21180.75, high: 21192.5, low: 21177.75, close: 21189.5 },
      { time: "10:40", open: 21189.5, high: 21202.75, low: 21186.5, close: 21199.75 },
      { time: "10:45", open: 21199.75, high: 21213, low: 21196.75, close: 21210 },
      { time: "10:50", open: 21210, high: 21217, low: 21207, close: 21214 },
      { time: "10:55", open: 21214, high: 21223.25, low: 21211, close: 21220.25 },
      { time: "11:00", open: 21220.25, high: 21227, low: 21217.25, close: 21224 },
      { time: "11:05", open: 21224, high: 21233, low: 21221, close: 21230 },
      { time: "11:10", open: 21230, high: 21233, low: 21212.5, close: 21215.5 },
      { time: "11:15", open: 21215.5, high: 21218.5, low: 21197.5, close: 21200.5 },
      { time: "11:20", open: 21200.5, high: 21203.5, low: 21181, close: 21184 },
      { time: "11:25", open: 21184, high: 21187, low: 21167, close: 21170 },
      { time: "11:30", open: 21170, high: 21173, low: 21147.75, close: 21150.75 },
      { time: "11:35", open: 21150.75, high: 21153.75, low: 21129.75, close: 21132.75 },
      { time: "11:40", open: 21132.75, high: 21135.75, low: 21112, close: 21115 },
      // Candle 28 — price re-enters the gap
      { time: "11:45", open: 21115, high: 21118, low: 21085, close: 21090 },
      // Candle 29 — chops inside the gap; looks like a pause, not yet a verdict
      { time: "11:50", open: 21090, high: 21093, low: 21082, close: 21085 },
      // Candle 30 — closes through the bottom and continues — DISRESPECTED, despite pausing first
      { time: "11:55", open: 21085, high: 21087, low: 21034, close: 21040 },
      { time: "12:00", open: 21040, high: 21043, low: 21025.5, close: 21028.5 },
      { time: "12:05", open: 21028.5, high: 21031.5, low: 21013, close: 21016 },
      { time: "12:10", open: 21016, high: 21019, low: 21000.75, close: 21003.75 },
      { time: "12:15", open: 21003.75, high: 21006.75, low: 20989.25, close: 20992.25 },
      { time: "12:20", open: 20992.25, high: 20995.25, low: 20977, close: 20980 },
      { time: "12:25", open: 20980, high: 20983, low: 20968, close: 20971 },
      { time: "12:30", open: 20971, high: 20974, low: 20960.25, close: 20963.25 },
      { time: "12:35", open: 20963.25, high: 20966.25, low: 20952.75, close: 20955.75 },
      { time: "12:40", open: 20955.75, high: 20958.75, low: 20946, close: 20949 },
      { time: "12:45", open: 20949, high: 20952, low: 20937, close: 20940 },
    ],
  },
  // ifvg-001: a bullish FVG at candles[8..10] (21063-21118) forms, then gets
  // disrespected at candle 25 (body closes below the lower boundary),
  // flipping it into resistance. The bounce at candles[31..36] is rejected
  // below the zone, confirming the flip. Verified: exactly one qualifying
  // gap in the series, and no candle body ever re-closes into/through the
  // zone after the break.
  {
    exercise_id: "ifvg-001",
    concept: "IFVG",
    answer_type: "zone",
    answerLabel: "Inverse Fair Value Gap",
    prompt: "Identify the Inverse Fair Value Gap, if there is one.",
    noAnswerLabel: "No IFVG present",
    instrument: "NQ (prototype data)",
    timeframe: "5m",
    difficulty: 1,
    has_answer: true,
    answer: {
      type: "bullish",
      price_low: 21063,
      price_high: 21118,
      candle_start: 8,
      candle_end: 10,
      key_candle_index: 9,
    },
    explanation:
      "This is a real Inverse Fair Value Gap. A Fair Value Gap forms here first, but later a candle's body closes all the way through its lower boundary — a real break, not just a wick. Once that happens, the old bullish gap flips: instead of a zone price bounces from, it becomes a zone price gets rejected from. When price came back up to test it, it stayed below the zone, confirming resistance.",
    candles: [
      { time: "09:30", open: 21000, high: 21011.5, low: 20998, close: 21007 },
      { time: "09:35", open: 21007, high: 21019.5, low: 21005, close: 21013 },
      { time: "09:40", open: 21013, high: 21024.5, low: 21011, close: 21021 },
      { time: "09:45", open: 21021, high: 21031.5, low: 21019, close: 21026 },
      { time: "09:50", open: 21026, high: 21037.5, low: 21024, close: 21033 },
      { time: "09:55", open: 21033, high: 21045.5, low: 21031, close: 21039 },
      { time: "10:00", open: 21039, high: 21050.5, low: 21037, close: 21047 },
      { time: "10:05", open: 21047, high: 21059.5, low: 21045, close: 21052 },
      // Candle 8 — candle 1 of the FVG
      { time: "10:10", open: 21052, high: 21063, low: 21050, close: 21061 },
      // Candle 9 — expansion candle
      { time: "10:15", open: 21061, high: 21127.5, low: 21059, close: 21121 },
      // Candle 10 — candle 3, confirms the gap (21063-21118)
      { time: "10:20", open: 21121, high: 21135.5, low: 21118, close: 21129 },
      { time: "10:25", open: 21129, high: 21139, low: 21127, close: 21137 },
      { time: "10:30", open: 21137, high: 21146, low: 21135, close: 21144 },
      { time: "10:35", open: 21144, high: 21148.5, low: 21139, close: 21141 },
      { time: "10:40", open: 21141, high: 21152, low: 21139, close: 21150 },
      { time: "10:45", open: 21150, high: 21158, low: 21148, close: 21156 },
      { time: "10:50", open: 21156, high: 21158, low: 21150, close: 21152 },
      { time: "10:55", open: 21152, high: 21163.5, low: 21150, close: 21160 },
      { time: "11:00", open: 21160, high: 21169, low: 21158, close: 21167 },
      { time: "11:05", open: 21167, high: 21169, low: 21158.5, close: 21165 },
      { time: "11:10", open: 21165, high: 21167, low: 21149.5, close: 21157 },
      { time: "11:15", open: 21157, high: 21159, low: 21142.5, close: 21148 },
      { time: "11:20", open: 21148, high: 21150, low: 21134.5, close: 21141 },
      { time: "11:25", open: 21141, high: 21143, low: 21128.5, close: 21133 },
      { time: "11:30", open: 21133, high: 21135, low: 21058.5, close: 21127 },
      // Candle 25 — body closes below the gap low — DISRESPECTED, now an IFVG (resistance)
      { time: "11:35", open: 21127, high: 21129, low: 21050.5, close: 21057 },
      { time: "11:40", open: 21057, high: 21059, low: 21043.5, close: 21049 },
      { time: "11:45", open: 21049, high: 21051, low: 21035.5, close: 21042 },
      { time: "11:50", open: 21042, high: 21044, low: 21029.5, close: 21034 },
      { time: "11:55", open: 21034, high: 21036, low: 21026, close: 21028 },
      { time: "12:00", open: 21028, high: 21030, low: 21021, close: 21023 },
      // Candle 31 — retest begins: price returns toward the flipped zone from below
      { time: "12:05", open: 21023, high: 21038.5, low: 21021, close: 21032 },
      { time: "12:10", open: 21032, high: 21042, low: 21030, close: 21040 },
      { time: "12:15", open: 21040, high: 21049, low: 21038, close: 21047 },
      { time: "12:20", open: 21047, high: 21049, low: 21037.5, close: 21044 },
      { time: "12:25", open: 21044, high: 21046, low: 21030.5, close: 21036 },
      { time: "12:30", open: 21036, high: 21038, low: 21021.5, close: 21029 },
      { time: "12:35", open: 21029, high: 21031, low: 21015.5, close: 21020 },
      { time: "12:40", open: 21020, high: 21022, low: 21012, close: 21014 },
      { time: "12:45", open: 21014, high: 21016, low: 21005, close: 21007 },
    ],
  },
  // ifvg-002: mirror of ifvg-001 — a bearish FVG at candles[8..10]
  // (21382-21437) forms, then gets disrespected at candle 25 (body closes
  // above the upper boundary), flipping it into support. The pullback at
  // candles[31..36] is rejected above the zone, confirming the flip.
  {
    exercise_id: "ifvg-002",
    concept: "IFVG",
    answer_type: "zone",
    answerLabel: "Inverse Fair Value Gap",
    prompt: "Identify the Inverse Fair Value Gap, if there is one.",
    noAnswerLabel: "No IFVG present",
    instrument: "NQ (prototype data)",
    timeframe: "5m",
    difficulty: 1,
    has_answer: true,
    answer: {
      type: "bearish",
      price_low: 21382,
      price_high: 21437,
      candle_start: 8,
      candle_end: 10,
      key_candle_index: 9,
    },
    explanation:
      "This is a real Inverse Fair Value Gap. A Fair Value Gap forms here first, but later a candle's body closes all the way through its upper boundary — a real break, not just a wick. Once that happens, the old bearish gap flips into support instead. When price pulled back down to test it, it stayed above the zone, confirming support.",
    candles: [
      { time: "09:30", open: 21500, high: 21502, low: 21488.5, close: 21493 },
      { time: "09:35", open: 21493, high: 21495, low: 21480.5, close: 21487 },
      { time: "09:40", open: 21487, high: 21489, low: 21475.5, close: 21479 },
      { time: "09:45", open: 21479, high: 21481, low: 21468.5, close: 21474 },
      { time: "09:50", open: 21474, high: 21476, low: 21462.5, close: 21467 },
      { time: "09:55", open: 21467, high: 21469, low: 21454.5, close: 21461 },
      { time: "10:00", open: 21461, high: 21463, low: 21449.5, close: 21453 },
      { time: "10:05", open: 21453, high: 21455, low: 21440.5, close: 21448 },
      // Candle 8 — candle 1 of the FVG
      { time: "10:10", open: 21448, high: 21450, low: 21437, close: 21439 },
      // Candle 9 — expansion candle
      { time: "10:15", open: 21439, high: 21441, low: 21372.5, close: 21379 },
      // Candle 10 — candle 3, confirms the gap (21382-21437)
      { time: "10:20", open: 21379, high: 21382, low: 21364.5, close: 21371 },
      { time: "10:25", open: 21371, high: 21373, low: 21361, close: 21363 },
      { time: "10:30", open: 21363, high: 21365, low: 21354, close: 21356 },
      { time: "10:35", open: 21356, high: 21361, low: 21351.5, close: 21359 },
      { time: "10:40", open: 21359, high: 21361, low: 21348, close: 21350 },
      { time: "10:45", open: 21350, high: 21352, low: 21342, close: 21344 },
      { time: "10:50", open: 21344, high: 21350, low: 21342, close: 21348 },
      { time: "10:55", open: 21348, high: 21350, low: 21336.5, close: 21340 },
      { time: "11:00", open: 21340, high: 21342, low: 21331, close: 21333 },
      { time: "11:05", open: 21333, high: 21341.5, low: 21331, close: 21335 },
      { time: "11:10", open: 21335, high: 21350.5, low: 21333, close: 21343 },
      { time: "11:15", open: 21343, high: 21357.5, low: 21341, close: 21352 },
      { time: "11:20", open: 21352, high: 21365.5, low: 21350, close: 21359 },
      { time: "11:25", open: 21359, high: 21371.5, low: 21357, close: 21367 },
      { time: "11:30", open: 21367, high: 21441.5, low: 21365, close: 21373 },
      // Candle 25 — body closes above the gap high — DISRESPECTED, now an IFVG (support)
      { time: "11:35", open: 21373, high: 21449.5, low: 21371, close: 21443 },
      { time: "11:40", open: 21443, high: 21456.5, low: 21441, close: 21451 },
      { time: "11:45", open: 21451, high: 21464.5, low: 21449, close: 21458 },
      { time: "11:50", open: 21458, high: 21470.5, low: 21456, close: 21466 },
      { time: "11:55", open: 21466, high: 21474, low: 21464, close: 21472 },
      { time: "12:00", open: 21472, high: 21479, low: 21470, close: 21477 },
      // Candle 31 — retest begins: price returns toward the flipped zone from above
      { time: "12:05", open: 21477, high: 21479, low: 21461.5, close: 21468 },
      { time: "12:10", open: 21468, high: 21470, low: 21458, close: 21460 },
      { time: "12:15", open: 21460, high: 21462, low: 21451, close: 21453 },
      { time: "12:20", open: 21453, high: 21462.5, low: 21451, close: 21456 },
      { time: "12:25", open: 21456, high: 21469.5, low: 21454, close: 21464 },
      { time: "12:30", open: 21464, high: 21478.5, low: 21462, close: 21471 },
      { time: "12:35", open: 21471, high: 21484.5, low: 21469, close: 21480 },
      { time: "12:40", open: 21480, high: 21488, low: 21478, close: 21486 },
      { time: "12:45", open: 21486, high: 21495, low: 21484, close: 21493 },
    ],
  },
  // ifvg-003: harder — two Fair Value Gaps exist on this chart, but only
  // Gap B (candles[20..22], 21162-21215) is ever disrespected (body close
  // below its lower boundary at candle 32). Gap A (candles[6..8],
  // 21049-21099) is never returned to and stays a normal, respected gap the
  // whole chart — it is NOT an IFVG. Verified: exactly two qualifying gaps
  // in the series, and Gap A's zone is never touched again after it forms.
  {
    exercise_id: "ifvg-003",
    concept: "IFVG",
    answer_type: "zone",
    answerLabel: "Inverse Fair Value Gap",
    prompt: "Identify the Inverse Fair Value Gap, if there is one.",
    noAnswerLabel: "No IFVG present",
    instrument: "NQ (prototype data)",
    timeframe: "5m",
    difficulty: 3,
    has_answer: true,
    answer: {
      type: "bullish",
      price_low: 21162,
      price_high: 21215,
      candle_start: 20,
      candle_end: 22,
      key_candle_index: 21,
    },
    explanation:
      "This is a real Inverse Fair Value Gap — but this chart has two Fair Value Gaps, and only one of them actually failed. The first gap, formed early, is never returned to and stays a normal, respected gap for the rest of the chart. The second gap gets a decisive body close through its lower boundary later on — that's the one that flips into an inverse level. A gap that's never disrespected is still just a regular Fair Value Gap, not an Inverse one, no matter how much time passes.",
    candles: [
      { time: "09:30", open: 21000, high: 21011.5, low: 20998, close: 21007 },
      { time: "09:35", open: 21007, high: 21019.5, low: 21005, close: 21013 },
      { time: "09:40", open: 21013, high: 21024.5, low: 21011, close: 21021 },
      { time: "09:45", open: 21021, high: 21031.5, low: 21019, close: 21026 },
      { time: "09:50", open: 21026, high: 21037.5, low: 21024, close: 21033 },
      { time: "09:55", open: 21033, high: 21045.5, low: 21031, close: 21039 },
      // Candle 6 — candle 1 of Gap A
      { time: "10:00", open: 21039, high: 21049, low: 21037, close: 21047 },
      // Candle 7 — expansion (Gap A)
      { time: "10:05", open: 21047, high: 21107.5, low: 21045, close: 21102 },
      // Candle 8 — candle 3, confirms Gap A (21049-21099) — never touched again, stays respected
      { time: "10:10", open: 21102, high: 21114.5, low: 21099, close: 21109 },
      { time: "10:15", open: 21109, high: 21118, low: 21107, close: 21116 },
      { time: "10:20", open: 21116, high: 21124, low: 21114, close: 21122 },
      { time: "10:25", open: 21122, high: 21125.5, low: 21117, close: 21119 },
      { time: "10:30", open: 21119, high: 21129, low: 21117, close: 21127 },
      { time: "10:35", open: 21127, high: 21134, low: 21125, close: 21132 },
      { time: "10:40", open: 21132, high: 21134, low: 21126, close: 21128 },
      { time: "10:45", open: 21128, high: 21137, low: 21126, close: 21135 },
      { time: "10:50", open: 21135, high: 21143, low: 21133, close: 21141 },
      { time: "10:55", open: 21141, high: 21145.5, low: 21137, close: 21139 },
      { time: "11:00", open: 21139, high: 21150.5, low: 21137, close: 21147 },
      { time: "11:05", open: 21147, high: 21158.5, low: 21145, close: 21152 },
      // Candle 20 — candle 1 of Gap B
      { time: "11:10", open: 21152, high: 21162, low: 21150, close: 21160 },
      // Candle 21 — expansion (Gap B)
      { time: "11:15", open: 21160, high: 21223.5, low: 21158, close: 21218 },
      // Candle 22 — candle 3, confirms Gap B (21162-21215)
      { time: "11:20", open: 21218, high: 21230.5, low: 21215, close: 21225 },
      { time: "11:25", open: 21225, high: 21234, low: 21223, close: 21232 },
      { time: "11:30", open: 21232, high: 21240, low: 21230, close: 21238 },
      { time: "11:35", open: 21238, high: 21240, low: 21233, close: 21235 },
      { time: "11:40", open: 21235, high: 21245, low: 21233, close: 21243 },
      { time: "11:45", open: 21243, high: 21245, low: 21231.5, close: 21237 },
      { time: "11:50", open: 21237, high: 21239, low: 21223.5, close: 21230 },
      { time: "11:55", open: 21230, high: 21232, low: 21217.5, close: 21222 },
      { time: "12:00", open: 21222, high: 21224, low: 21212.5, close: 21216 },
      { time: "12:05", open: 21216, high: 21218, low: 21152.5, close: 21211 },
      // Candle 32 — body closes below Gap B's lower boundary — DISRESPECTED, Gap B is the IFVG
      { time: "12:10", open: 21211, high: 21213, low: 21145.5, close: 21151 },
      { time: "12:15", open: 21151, high: 21153, low: 21139.5, close: 21144 },
      { time: "12:20", open: 21144, high: 21146, low: 21131.5, close: 21138 },
      { time: "12:25", open: 21138, high: 21140, low: 21126.5, close: 21130 },
      { time: "12:30", open: 21130, high: 21132, low: 21119.5, close: 21125 },
      { time: "12:35", open: 21125, high: 21127, low: 21113.5, close: 21118 },
      { time: "12:40", open: 21118, high: 21120, low: 21110, close: 21112 },
      { time: "12:45", open: 21112, high: 21114, low: 21102, close: 21104 },
    ],
  },
  // ifvg-004: has_answer is false. A real Fair Value Gap forms at
  // candles[8..10] (21063-21118), and candle 28's wick dips well through
  // its lower boundary (down to 21048) — but its body closes at 21095,
  // still inside/above the gap, so no body-close break ever happens. The
  // gap is never disrespected, so it stays a normal Fair Value Gap — not an
  // IFVG. Verified: no candle body ever closes beyond either boundary
  // anywhere in the series.
  {
    exercise_id: "ifvg-004",
    concept: "IFVG",
    answer_type: "zone",
    answerLabel: "Inverse Fair Value Gap",
    prompt: "Identify the Inverse Fair Value Gap, if there is one.",
    noAnswerLabel: "No IFVG present",
    instrument: "NQ (prototype data)",
    timeframe: "5m",
    difficulty: 2,
    has_answer: false,
    answer: null,
    explanation:
      "A real Fair Value Gap forms here, and later price dives back down and wicks straight through its lower boundary — but no candle's body ever closes beyond it. A wick alone doesn't invalidate a gap; only a body close does. Since the gap was never actually disrespected, it's still just a regular Fair Value Gap, not an Inverse Fair Value Gap.",
    distractor_note:
      "A real Fair Value Gap forms here, and later price dives back down and wicks straight through its lower boundary — but no candle's body ever closes beyond it. A wick alone doesn't invalidate a gap; only a body close does. Since the gap was never actually disrespected, it's still just a regular Fair Value Gap, not an Inverse Fair Value Gap.",
    candles: [
      { time: "09:30", open: 21000, high: 21011.5, low: 20998, close: 21007 },
      { time: "09:35", open: 21007, high: 21019.5, low: 21005, close: 21013 },
      { time: "09:40", open: 21013, high: 21024.5, low: 21011, close: 21021 },
      { time: "09:45", open: 21021, high: 21031.5, low: 21019, close: 21026 },
      { time: "09:50", open: 21026, high: 21037.5, low: 21024, close: 21033 },
      { time: "09:55", open: 21033, high: 21045.5, low: 21031, close: 21039 },
      { time: "10:00", open: 21039, high: 21050.5, low: 21037, close: 21047 },
      { time: "10:05", open: 21047, high: 21059.5, low: 21045, close: 21052 },
      // Candle 8 — candle 1 of the FVG
      { time: "10:10", open: 21052, high: 21063, low: 21050, close: 21061 },
      // Candle 9 — expansion candle
      { time: "10:15", open: 21061, high: 21127.5, low: 21059, close: 21121 },
      // Candle 10 — candle 3, confirms the gap (21063-21118)
      { time: "10:20", open: 21121, high: 21135.5, low: 21118, close: 21129 },
      { time: "10:25", open: 21129, high: 21139, low: 21127, close: 21137 },
      { time: "10:30", open: 21137, high: 21146, low: 21135, close: 21144 },
      { time: "10:35", open: 21144, high: 21148.5, low: 21139, close: 21141 },
      { time: "10:40", open: 21141, high: 21152, low: 21139, close: 21150 },
      { time: "10:45", open: 21150, high: 21158, low: 21148, close: 21156 },
      { time: "10:50", open: 21156, high: 21158, low: 21150, close: 21152 },
      { time: "10:55", open: 21152, high: 21163.5, low: 21150, close: 21160 },
      { time: "11:00", open: 21160, high: 21169, low: 21158, close: 21167 },
      { time: "11:05", open: 21167, high: 21169, low: 21156.5, close: 21165 },
      { time: "11:10", open: 21165, high: 21167, low: 21147.5, close: 21155 },
      { time: "11:15", open: 21155, high: 21157, low: 21139.5, close: 21146 },
      { time: "11:20", open: 21146, high: 21148, low: 21130.5, close: 21138 },
      { time: "11:25", open: 21138, high: 21140, low: 21122.5, close: 21129 },
      { time: "11:30", open: 21129, high: 21131, low: 21115.5, close: 21121 },
      { time: "11:35", open: 21121, high: 21123, low: 21107.5, close: 21114 },
      { time: "11:40", open: 21114, high: 21116, low: 21101.5, close: 21106 },
      { time: "11:45", open: 21106, high: 21108, low: 21098, close: 21100 },
      // Candle 28 — wick dips to 21048, through the gap's lower boundary, but the body closes at 21095 — no body close, still respected
      { time: "11:50", open: 21100, high: 21123.5, low: 21048, close: 21095 },
      // Candle 29 — reverses back up decisively
      { time: "11:55", open: 21095, high: 21131.5, low: 21093, close: 21125 },
      { time: "12:00", open: 21125, high: 21138.5, low: 21123, close: 21133 },
      { time: "12:05", open: 21133, high: 21147.5, low: 21131, close: 21140 },
      { time: "12:10", open: 21140, high: 21153.5, low: 21138, close: 21149 },
      { time: "12:15", open: 21149, high: 21161.5, low: 21147, close: 21155 },
      { time: "12:20", open: 21155, high: 21168.5, low: 21153, close: 21163 },
      { time: "12:25", open: 21163, high: 21177.5, low: 21161, close: 21170 },
      { time: "12:30", open: 21170, high: 21183.5, low: 21168, close: 21179 },
      { time: "12:35", open: 21179, high: 21191.5, low: 21177, close: 21185 },
      { time: "12:40", open: 21185, high: 21195, low: 21183, close: 21193 },
      { time: "12:45", open: 21193, high: 21202, low: 21191, close: 21200 },
    ],
  },
  // ifvg-005: harder — a smaller gap (21420.5-21452) inside choppier price
  // action. Candles 27-28 chop right at the boundary without a decisive
  // close; candle 29 finally closes through it, confirming the flip.
  // Verified: exactly one qualifying gap in the series, and no candle body
  // closes beyond the boundary before candle 29.
  {
    exercise_id: "ifvg-005",
    concept: "IFVG",
    answer_type: "zone",
    answerLabel: "Inverse Fair Value Gap",
    prompt: "Identify the Inverse Fair Value Gap, if there is one.",
    noAnswerLabel: "No IFVG present",
    instrument: "NQ (prototype data)",
    timeframe: "5m",
    difficulty: 3,
    has_answer: true,
    answer: {
      type: "bullish",
      price_low: 21420.5,
      price_high: 21452,
      candle_start: 8,
      candle_end: 10,
      key_candle_index: 9,
    },
    explanation:
      "This is a real Inverse Fair Value Gap, just a harder one to catch. Price chops right at the gap's lower boundary for a couple of candles without deciding anything — no body closes beyond it yet. Then a decisive candle finally closes through, and that's the moment the gap flips from a bullish zone into resistance. The pause beforehand doesn't count; only the body close that actually breaks through does.",
    candles: [
      { time: "09:30", open: 21400, high: 21407, low: 21398, close: 21405 },
      { time: "09:35", open: 21405, high: 21407, low: 21401, close: 21403 },
      { time: "09:40", open: 21403, high: 21411, low: 21401, close: 21409 },
      { time: "09:45", open: 21409, high: 21411, low: 21404, close: 21406 },
      { time: "09:50", open: 21406, high: 21415, low: 21404, close: 21413 },
      { time: "09:55", open: 21413, high: 21415, low: 21409, close: 21411 },
      { time: "10:00", open: 21411, high: 21418, low: 21409, close: 21416 },
      { time: "10:05", open: 21416, high: 21418, low: 21411, close: 21413 },
      // Candle 8 — candle 1 of the FVG
      { time: "10:10", open: 21413, high: 21420.5, low: 21411, close: 21419 },
      // Candle 9 — expansion candle
      { time: "10:15", open: 21419, high: 21457.5, low: 21417, close: 21454 },
      // Candle 10 — candle 3, confirms the gap (21420.5-21452)
      { time: "10:20", open: 21454, high: 21461, low: 21452, close: 21459 },
      { time: "10:25", open: 21459, high: 21466, low: 21457, close: 21464 },
      { time: "10:30", open: 21464, high: 21466, low: 21459, close: 21461 },
      { time: "10:35", open: 21461, high: 21469, low: 21459, close: 21467 },
      { time: "10:40", open: 21467, high: 21469, low: 21463, close: 21465 },
      { time: "10:45", open: 21465, high: 21471, low: 21463, close: 21469 },
      { time: "10:50", open: 21469, high: 21471, low: 21464, close: 21466 },
      { time: "10:55", open: 21466, high: 21473, low: 21464, close: 21471 },
      { time: "11:00", open: 21471, high: 21473, low: 21467, close: 21469 },
      { time: "11:05", open: 21469, high: 21475, low: 21467, close: 21473 },
      { time: "11:10", open: 21473, high: 21475, low: 21465, close: 21467 },
      { time: "11:15", open: 21467, high: 21472, low: 21465, close: 21470 },
      { time: "11:20", open: 21470, high: 21472, low: 21461, close: 21463 },
      { time: "11:25", open: 21463, high: 21467, low: 21461, close: 21465 },
      { time: "11:30", open: 21465, high: 21467, low: 21457, close: 21459 },
      { time: "11:35", open: 21459, high: 21464, low: 21457, close: 21462 },
      { time: "11:40", open: 21462, high: 21464, low: 21453, close: 21455 },
      // Candle 27 — pauses right at the boundary, no decisive close
      { time: "11:45", open: 21455, high: 21457, low: 21451, close: 21453 },
      // Candle 28 — still chopping, no decisive close
      { time: "11:50", open: 21453, high: 21456, low: 21415.5, close: 21454 },
      // Candle 29 — body closes below the gap's lower boundary — DISRESPECTED, now an IFVG
      { time: "11:55", open: 21454, high: 21456, low: 21409.5, close: 21414 },
      { time: "12:00", open: 21414, high: 21416, low: 21404.5, close: 21408 },
      { time: "12:05", open: 21408, high: 21410, low: 21397.5, close: 21403 },
      { time: "12:10", open: 21403, high: 21405, low: 21394, close: 21396 },
      { time: "12:15", open: 21396, high: 21398, low: 21387.5, close: 21392 },
      { time: "12:20", open: 21392, high: 21394, low: 21382.5, close: 21386 },
      { time: "12:25", open: 21386, high: 21388, low: 21375.5, close: 21381 },
      { time: "12:30", open: 21381, high: 21383, low: 21372, close: 21374 },
      { time: "12:35", open: 21374, high: 21376, low: 21365.5, close: 21370 },
      { time: "12:40", open: 21370, high: 21372, low: 21362, close: 21364 },
      { time: "12:45", open: 21364, high: 21366, low: 21357, close: 21359 },
    ],
  },
  // ifvg-resp-001: the FVG at candles[8..10] fails at candle 25 (body
  // closes below the lower boundary), flipping it into resistance. The
  // retest starting at candle 30 stays below the zone's upper boundary the
  // whole time — RESPECTED (the flip holds). Verified: no candle body
  // during the retest closes back above 21118.
  {
    exercise_id: "ifvg-resp-001",
    concept: "IFVG",
    answer_type: "choice",
    answerLabel: "IFVG Respected vs. Disrespected",
    prompt:
      "This chart shows an Inverse Fair Value Gap (shaded) — a Fair Value Gap that already failed and flipped into the opposite kind of level — and the price action after it. Was this level respected or disrespected on the retest?",
    options: [
      { value: "respected", label: "Respected" },
      { value: "disrespected", label: "Disrespected" },
    ],
    instrument: "NQ (prototype data)",
    timeframe: "5m",
    difficulty: 2,
    answer: {
      correct_choice: "respected",
      fvg_zone: { price_low: 21063, price_high: 21118, candle_start: 8, candle_end: 10 },
    },
    explanation:
      "This Inverse Fair Value Gap was respected. The original Fair Value Gap failed earlier — a candle body closed through its lower boundary, flipping the zone into resistance. When price came back up to test it, its body never closed back above the zone's upper boundary at 21118 — a wick reaching into the zone wouldn't count either way, only a body close would. Since nothing closed back through, the flipped resistance held, and price kept falling from there.",
    candles: [
      { time: "09:30", open: 21000, high: 21011.5, low: 20998, close: 21007 },
      { time: "09:35", open: 21007, high: 21019.5, low: 21005, close: 21013 },
      { time: "09:40", open: 21013, high: 21024.5, low: 21011, close: 21021 },
      { time: "09:45", open: 21021, high: 21031.5, low: 21019, close: 21026 },
      { time: "09:50", open: 21026, high: 21037.5, low: 21024, close: 21033 },
      { time: "09:55", open: 21033, high: 21045.5, low: 21031, close: 21039 },
      { time: "10:00", open: 21039, high: 21050.5, low: 21037, close: 21047 },
      { time: "10:05", open: 21047, high: 21059.5, low: 21045, close: 21052 },
      // Candle 8 — candle 1 of the FVG
      { time: "10:10", open: 21052, high: 21063, low: 21050, close: 21061 },
      // Candle 9 — expansion candle
      { time: "10:15", open: 21061, high: 21127.5, low: 21059, close: 21121 },
      // Candle 10 — candle 3, confirms the gap (21063-21118)
      { time: "10:20", open: 21121, high: 21135.5, low: 21118, close: 21129 },
      { time: "10:25", open: 21129, high: 21139, low: 21127, close: 21137 },
      { time: "10:30", open: 21137, high: 21146, low: 21135, close: 21144 },
      { time: "10:35", open: 21144, high: 21148.5, low: 21139, close: 21141 },
      { time: "10:40", open: 21141, high: 21152, low: 21139, close: 21150 },
      { time: "10:45", open: 21150, high: 21158, low: 21148, close: 21156 },
      { time: "10:50", open: 21156, high: 21158, low: 21150, close: 21152 },
      { time: "10:55", open: 21152, high: 21163.5, low: 21150, close: 21160 },
      { time: "11:00", open: 21160, high: 21169, low: 21158, close: 21167 },
      { time: "11:05", open: 21167, high: 21169, low: 21158.5, close: 21165 },
      { time: "11:10", open: 21165, high: 21167, low: 21149.5, close: 21157 },
      { time: "11:15", open: 21157, high: 21159, low: 21142.5, close: 21148 },
      { time: "11:20", open: 21148, high: 21150, low: 21134.5, close: 21141 },
      { time: "11:25", open: 21141, high: 21143, low: 21128.5, close: 21133 },
      { time: "11:30", open: 21133, high: 21135, low: 21058.5, close: 21127 },
      // Candle 25 — body closes below the gap low — flips to an IFVG (resistance)
      { time: "11:35", open: 21127, high: 21129, low: 21050.5, close: 21057 },
      { time: "11:40", open: 21057, high: 21059, low: 21043.5, close: 21049 },
      { time: "11:45", open: 21049, high: 21051, low: 21035.5, close: 21042 },
      { time: "11:50", open: 21042, high: 21044, low: 21032, close: 21034 },
      { time: "11:55", open: 21034, high: 21036, low: 21026, close: 21028 },
      // Candle 30 — retest begins
      { time: "12:00", open: 21028, high: 21043.5, low: 21026, close: 21037 },
      { time: "12:05", open: 21037, high: 21047, low: 21035, close: 21045 },
      { time: "12:10", open: 21045, high: 21054, low: 21043, close: 21052 },
      { time: "12:15", open: 21052, high: 21054, low: 21043.5, close: 21049 },
      { time: "12:20", open: 21049, high: 21051, low: 21037.5, close: 21042 },
      { time: "12:25", open: 21042, high: 21044, low: 21029.5, close: 21036 },
      { time: "12:30", open: 21036, high: 21038, low: 21024.5, close: 21028 },
      { time: "12:35", open: 21028, high: 21030, low: 21017.5, close: 21023 },
      { time: "12:40", open: 21023, high: 21025, low: 21014, close: 21016 },
      { time: "12:45", open: 21016, high: 21018, low: 21008, close: 21010 },
    ],
  },
  // ifvg-resp-002: mirror of ifvg-resp-001 — the bearish FVG fails at
  // candle 25, flipping into support. The retest stays above the zone's
  // lower boundary — RESPECTED.
  {
    exercise_id: "ifvg-resp-002",
    concept: "IFVG",
    answer_type: "choice",
    answerLabel: "IFVG Respected vs. Disrespected",
    prompt:
      "This chart shows an Inverse Fair Value Gap (shaded) — a Fair Value Gap that already failed and flipped into the opposite kind of level — and the price action after it. Was this level respected or disrespected on the retest?",
    options: [
      { value: "respected", label: "Respected" },
      { value: "disrespected", label: "Disrespected" },
    ],
    instrument: "NQ (prototype data)",
    timeframe: "5m",
    difficulty: 2,
    answer: {
      correct_choice: "respected",
      fvg_zone: { price_low: 21382, price_high: 21437, candle_start: 8, candle_end: 10 },
    },
    explanation:
      "This Inverse Fair Value Gap was respected. The original Fair Value Gap failed earlier — a candle body closed through its upper boundary, flipping the zone into support. When price pulled back down to test it, its body never closed back below the zone's lower boundary at 21382. Since nothing closed back through, the flipped support held, and price kept rising from there.",
    candles: [
      { time: "09:30", open: 21500, high: 21502, low: 21488.5, close: 21493 },
      { time: "09:35", open: 21493, high: 21495, low: 21480.5, close: 21487 },
      { time: "09:40", open: 21487, high: 21489, low: 21475.5, close: 21479 },
      { time: "09:45", open: 21479, high: 21481, low: 21468.5, close: 21474 },
      { time: "09:50", open: 21474, high: 21476, low: 21462.5, close: 21467 },
      { time: "09:55", open: 21467, high: 21469, low: 21454.5, close: 21461 },
      { time: "10:00", open: 21461, high: 21463, low: 21449.5, close: 21453 },
      { time: "10:05", open: 21453, high: 21455, low: 21440.5, close: 21448 },
      // Candle 8 — candle 1 of the FVG
      { time: "10:10", open: 21448, high: 21450, low: 21437, close: 21439 },
      // Candle 9 — expansion candle
      { time: "10:15", open: 21439, high: 21441, low: 21372.5, close: 21379 },
      // Candle 10 — candle 3, confirms the gap (21382-21437)
      { time: "10:20", open: 21379, high: 21382, low: 21364.5, close: 21371 },
      { time: "10:25", open: 21371, high: 21373, low: 21361, close: 21363 },
      { time: "10:30", open: 21363, high: 21365, low: 21354, close: 21356 },
      { time: "10:35", open: 21356, high: 21361, low: 21351.5, close: 21359 },
      { time: "10:40", open: 21359, high: 21361, low: 21348, close: 21350 },
      { time: "10:45", open: 21350, high: 21352, low: 21342, close: 21344 },
      { time: "10:50", open: 21344, high: 21350, low: 21342, close: 21348 },
      { time: "10:55", open: 21348, high: 21350, low: 21336.5, close: 21340 },
      { time: "11:00", open: 21340, high: 21342, low: 21331, close: 21333 },
      { time: "11:05", open: 21333, high: 21341.5, low: 21331, close: 21335 },
      { time: "11:10", open: 21335, high: 21350.5, low: 21333, close: 21343 },
      { time: "11:15", open: 21343, high: 21357.5, low: 21341, close: 21352 },
      { time: "11:20", open: 21352, high: 21365.5, low: 21350, close: 21359 },
      { time: "11:25", open: 21359, high: 21371.5, low: 21357, close: 21367 },
      { time: "11:30", open: 21367, high: 21441.5, low: 21365, close: 21373 },
      // Candle 25 — body closes above the gap high — flips to an IFVG (support)
      { time: "11:35", open: 21373, high: 21449.5, low: 21371, close: 21443 },
      { time: "11:40", open: 21443, high: 21456.5, low: 21441, close: 21451 },
      { time: "11:45", open: 21451, high: 21464.5, low: 21449, close: 21458 },
      { time: "11:50", open: 21458, high: 21468, low: 21456, close: 21466 },
      { time: "11:55", open: 21466, high: 21474, low: 21464, close: 21472 },
      // Candle 30 — retest begins
      { time: "12:00", open: 21472, high: 21474, low: 21456.5, close: 21463 },
      { time: "12:05", open: 21463, high: 21465, low: 21453, close: 21455 },
      { time: "12:10", open: 21455, high: 21457, low: 21446, close: 21448 },
      { time: "12:15", open: 21448, high: 21456.5, low: 21446, close: 21451 },
      { time: "12:20", open: 21451, high: 21462.5, low: 21449, close: 21458 },
      { time: "12:25", open: 21458, high: 21470.5, low: 21456, close: 21464 },
      { time: "12:30", open: 21464, high: 21475.5, low: 21462, close: 21472 },
      { time: "12:35", open: 21472, high: 21482.5, low: 21470, close: 21477 },
      { time: "12:40", open: 21477, high: 21486, low: 21475, close: 21484 },
      { time: "12:45", open: 21484, high: 21492, low: 21482, close: 21490 },
    ],
  },
  // ifvg-resp-003: the FVG fails at candle 25, flipping into resistance —
  // but on the retest, candle 33's body closes back above the zone's upper
  // boundary (21118), undoing the flip. DISRESPECTED.
  {
    exercise_id: "ifvg-resp-003",
    concept: "IFVG",
    answer_type: "choice",
    answerLabel: "IFVG Respected vs. Disrespected",
    prompt:
      "This chart shows an Inverse Fair Value Gap (shaded) — a Fair Value Gap that already failed and flipped into the opposite kind of level — and the price action after it. Was this level respected or disrespected on the retest?",
    options: [
      { value: "respected", label: "Respected" },
      { value: "disrespected", label: "Disrespected" },
    ],
    instrument: "NQ (prototype data)",
    timeframe: "5m",
    difficulty: 2,
    answer: {
      correct_choice: "disrespected",
      fvg_zone: { price_low: 21063, price_high: 21118, candle_start: 8, candle_end: 10 },
    },
    explanation:
      "This Inverse Fair Value Gap was disrespected. The original Fair Value Gap failed earlier, flipping the zone into resistance. But when price came back up to test it, a candle's body closed back above the zone's upper boundary at 21118 — a real break, not just a wick. That body close undoes the flip: the level failed to hold as resistance, and price kept rising through it.",
    candles: [
      { time: "09:30", open: 21000, high: 21011.5, low: 20998, close: 21007 },
      { time: "09:35", open: 21007, high: 21019.5, low: 21005, close: 21013 },
      { time: "09:40", open: 21013, high: 21024.5, low: 21011, close: 21021 },
      { time: "09:45", open: 21021, high: 21031.5, low: 21019, close: 21026 },
      { time: "09:50", open: 21026, high: 21037.5, low: 21024, close: 21033 },
      { time: "09:55", open: 21033, high: 21045.5, low: 21031, close: 21039 },
      { time: "10:00", open: 21039, high: 21050.5, low: 21037, close: 21047 },
      { time: "10:05", open: 21047, high: 21059.5, low: 21045, close: 21052 },
      // Candle 8 — candle 1 of the FVG
      { time: "10:10", open: 21052, high: 21063, low: 21050, close: 21061 },
      // Candle 9 — expansion candle
      { time: "10:15", open: 21061, high: 21127.5, low: 21059, close: 21121 },
      // Candle 10 — candle 3, confirms the gap (21063-21118)
      { time: "10:20", open: 21121, high: 21135.5, low: 21118, close: 21129 },
      { time: "10:25", open: 21129, high: 21139, low: 21127, close: 21137 },
      { time: "10:30", open: 21137, high: 21146, low: 21135, close: 21144 },
      { time: "10:35", open: 21144, high: 21148.5, low: 21139, close: 21141 },
      { time: "10:40", open: 21141, high: 21152, low: 21139, close: 21150 },
      { time: "10:45", open: 21150, high: 21158, low: 21148, close: 21156 },
      { time: "10:50", open: 21156, high: 21158, low: 21150, close: 21152 },
      { time: "10:55", open: 21152, high: 21163.5, low: 21150, close: 21160 },
      { time: "11:00", open: 21160, high: 21169, low: 21158, close: 21167 },
      { time: "11:05", open: 21167, high: 21169, low: 21158.5, close: 21165 },
      { time: "11:10", open: 21165, high: 21167, low: 21149.5, close: 21157 },
      { time: "11:15", open: 21157, high: 21159, low: 21142.5, close: 21148 },
      { time: "11:20", open: 21148, high: 21150, low: 21134.5, close: 21141 },
      { time: "11:25", open: 21141, high: 21143, low: 21128.5, close: 21133 },
      { time: "11:30", open: 21133, high: 21135, low: 21058.5, close: 21127 },
      // Candle 25 — body closes below the gap low — flips to an IFVG (resistance)
      { time: "11:35", open: 21127, high: 21129, low: 21050.5, close: 21057 },
      { time: "11:40", open: 21057, high: 21059, low: 21043.5, close: 21049 },
      { time: "11:45", open: 21049, high: 21051, low: 21035.5, close: 21042 },
      { time: "11:50", open: 21042, high: 21044, low: 21032, close: 21034 },
      { time: "11:55", open: 21034, high: 21036, low: 21026, close: 21028 },
      { time: "12:00", open: 21028, high: 21043.5, low: 21026, close: 21037 },
      { time: "12:05", open: 21037, high: 21050.5, low: 21035, close: 21045 },
      { time: "12:10", open: 21045, high: 21110.5, low: 21043, close: 21052 },
      // Candle 33 — retest candle closes back above the gap high — DISRESPECTED
      { time: "12:15", open: 21052, high: 21118.5, low: 21050, close: 21112 },
      { time: "12:20", open: 21112, high: 21125.5, low: 21110, close: 21120 },
      { time: "12:25", open: 21120, high: 21134.5, low: 21118, close: 21127 },
      { time: "12:30", open: 21127, high: 21140.5, low: 21125, close: 21136 },
      { time: "12:35", open: 21136, high: 21148.5, low: 21134, close: 21142 },
      { time: "12:40", open: 21142, high: 21152, low: 21140, close: 21150 },
      { time: "12:45", open: 21150, high: 21159, low: 21148, close: 21157 },
    ],
  },
  // ifvg-resp-004: mirror of ifvg-resp-003 — the bearish FVG fails at
  // candle 25, flipping into support, but candle 33's body closes back
  // below the zone's lower boundary (21382), undoing the flip.
  // DISRESPECTED.
  {
    exercise_id: "ifvg-resp-004",
    concept: "IFVG",
    answer_type: "choice",
    answerLabel: "IFVG Respected vs. Disrespected",
    prompt:
      "This chart shows an Inverse Fair Value Gap (shaded) — a Fair Value Gap that already failed and flipped into the opposite kind of level — and the price action after it. Was this level respected or disrespected on the retest?",
    options: [
      { value: "respected", label: "Respected" },
      { value: "disrespected", label: "Disrespected" },
    ],
    instrument: "NQ (prototype data)",
    timeframe: "5m",
    difficulty: 2,
    answer: {
      correct_choice: "disrespected",
      fvg_zone: { price_low: 21382, price_high: 21437, candle_start: 8, candle_end: 10 },
    },
    explanation:
      "This Inverse Fair Value Gap was disrespected. The original Fair Value Gap failed earlier, flipping the zone into support. But when price pulled back down to test it, a candle's body closed back below the zone's lower boundary at 21382 — a real break, not just a wick. That body close undoes the flip: the level failed to hold as support, and price kept falling through it.",
    candles: [
      { time: "09:30", open: 21500, high: 21502, low: 21488.5, close: 21493 },
      { time: "09:35", open: 21493, high: 21495, low: 21480.5, close: 21487 },
      { time: "09:40", open: 21487, high: 21489, low: 21475.5, close: 21479 },
      { time: "09:45", open: 21479, high: 21481, low: 21468.5, close: 21474 },
      { time: "09:50", open: 21474, high: 21476, low: 21462.5, close: 21467 },
      { time: "09:55", open: 21467, high: 21469, low: 21454.5, close: 21461 },
      { time: "10:00", open: 21461, high: 21463, low: 21449.5, close: 21453 },
      { time: "10:05", open: 21453, high: 21455, low: 21440.5, close: 21448 },
      // Candle 8 — candle 1 of the FVG
      { time: "10:10", open: 21448, high: 21450, low: 21437, close: 21439 },
      // Candle 9 — expansion candle
      { time: "10:15", open: 21439, high: 21441, low: 21372.5, close: 21379 },
      // Candle 10 — candle 3, confirms the gap (21382-21437)
      { time: "10:20", open: 21379, high: 21382, low: 21364.5, close: 21371 },
      { time: "10:25", open: 21371, high: 21373, low: 21361, close: 21363 },
      { time: "10:30", open: 21363, high: 21365, low: 21354, close: 21356 },
      { time: "10:35", open: 21356, high: 21361, low: 21351.5, close: 21359 },
      { time: "10:40", open: 21359, high: 21361, low: 21348, close: 21350 },
      { time: "10:45", open: 21350, high: 21352, low: 21342, close: 21344 },
      { time: "10:50", open: 21344, high: 21350, low: 21342, close: 21348 },
      { time: "10:55", open: 21348, high: 21350, low: 21336.5, close: 21340 },
      { time: "11:00", open: 21340, high: 21342, low: 21331, close: 21333 },
      { time: "11:05", open: 21333, high: 21341.5, low: 21331, close: 21335 },
      { time: "11:10", open: 21335, high: 21350.5, low: 21333, close: 21343 },
      { time: "11:15", open: 21343, high: 21357.5, low: 21341, close: 21352 },
      { time: "11:20", open: 21352, high: 21365.5, low: 21350, close: 21359 },
      { time: "11:25", open: 21359, high: 21371.5, low: 21357, close: 21367 },
      { time: "11:30", open: 21367, high: 21441.5, low: 21365, close: 21373 },
      // Candle 25 — body closes above the gap high — flips to an IFVG (support)
      { time: "11:35", open: 21373, high: 21449.5, low: 21371, close: 21443 },
      { time: "11:40", open: 21443, high: 21456.5, low: 21441, close: 21451 },
      { time: "11:45", open: 21451, high: 21464.5, low: 21449, close: 21458 },
      { time: "11:50", open: 21458, high: 21468, low: 21456, close: 21466 },
      { time: "11:55", open: 21466, high: 21474, low: 21464, close: 21472 },
      { time: "12:00", open: 21472, high: 21474, low: 21456.5, close: 21463 },
      { time: "12:05", open: 21463, high: 21465, low: 21449.5, close: 21455 },
      { time: "12:10", open: 21455, high: 21457, low: 21389.5, close: 21448 },
      // Candle 33 — retest candle closes back below the gap low — DISRESPECTED
      { time: "12:15", open: 21448, high: 21450, low: 21381.5, close: 21388 },
      { time: "12:20", open: 21388, high: 21390, low: 21374.5, close: 21380 },
      { time: "12:25", open: 21380, high: 21382, low: 21365.5, close: 21373 },
      { time: "12:30", open: 21373, high: 21375, low: 21359.5, close: 21364 },
      { time: "12:35", open: 21364, high: 21366, low: 21351.5, close: 21358 },
      { time: "12:40", open: 21358, high: 21360, low: 21348, close: 21350 },
      { time: "12:45", open: 21350, high: 21352, low: 21341, close: 21343 },
    ],
  },
  // ifvg-resp-005: harder — the IFVG at candles[8..10] (21420.5-21452)
  // forms after candle 30's body close, then price chops right at the
  // retest for two candles (31-32) before candle 33 finally closes back
  // above the zone — DISRESPECTED, despite the pause.
  {
    exercise_id: "ifvg-resp-005",
    concept: "IFVG",
    answer_type: "choice",
    answerLabel: "IFVG Respected vs. Disrespected",
    prompt:
      "This chart shows an Inverse Fair Value Gap (shaded) — a Fair Value Gap that already failed and flipped into the opposite kind of level — and the price action after it. Was this level respected or disrespected on the retest?",
    options: [
      { value: "respected", label: "Respected" },
      { value: "disrespected", label: "Disrespected" },
    ],
    instrument: "NQ (prototype data)",
    timeframe: "5m",
    difficulty: 3,
    answer: {
      correct_choice: "disrespected",
      fvg_zone: { price_low: 21420.5, price_high: 21452, candle_start: 8, candle_end: 10 },
    },
    explanation:
      "This Inverse Fair Value Gap was disrespected, even though it doesn't look that way at first. Price chops right at the flipped zone for a couple of candles without deciding anything — a pause, not a reaction. Then a candle's body closes back above the zone's upper boundary at 21452, undoing the flip for good. The pause beforehand doesn't matter — only the body close that actually breaks through does.",
    candles: [
      { time: "09:30", open: 21400, high: 21407, low: 21398, close: 21405 },
      { time: "09:35", open: 21405, high: 21407, low: 21401, close: 21403 },
      { time: "09:40", open: 21403, high: 21411, low: 21401, close: 21409 },
      { time: "09:45", open: 21409, high: 21411, low: 21404, close: 21406 },
      { time: "09:50", open: 21406, high: 21415, low: 21404, close: 21413 },
      { time: "09:55", open: 21413, high: 21415, low: 21409, close: 21411 },
      { time: "10:00", open: 21411, high: 21418, low: 21409, close: 21416 },
      { time: "10:05", open: 21416, high: 21418, low: 21411, close: 21413 },
      // Candle 8 — candle 1 of the FVG
      { time: "10:10", open: 21413, high: 21420.5, low: 21411, close: 21419 },
      // Candle 9 — expansion candle
      { time: "10:15", open: 21419, high: 21457.5, low: 21417, close: 21454 },
      // Candle 10 — candle 3, confirms the gap (21420.5-21452)
      { time: "10:20", open: 21454, high: 21461, low: 21452, close: 21459 },
      { time: "10:25", open: 21459, high: 21466, low: 21457, close: 21464 },
      { time: "10:30", open: 21464, high: 21466, low: 21459, close: 21461 },
      { time: "10:35", open: 21461, high: 21469, low: 21459, close: 21467 },
      { time: "10:40", open: 21467, high: 21469, low: 21463, close: 21465 },
      { time: "10:45", open: 21465, high: 21471, low: 21463, close: 21469 },
      { time: "10:50", open: 21469, high: 21471, low: 21464, close: 21466 },
      { time: "10:55", open: 21466, high: 21473, low: 21464, close: 21471 },
      { time: "11:00", open: 21471, high: 21473, low: 21467, close: 21469 },
      { time: "11:05", open: 21469, high: 21475, low: 21467, close: 21473 },
      { time: "11:10", open: 21473, high: 21475, low: 21465, close: 21467 },
      { time: "11:15", open: 21467, high: 21472, low: 21465, close: 21470 },
      { time: "11:20", open: 21470, high: 21472, low: 21461, close: 21463 },
      { time: "11:25", open: 21463, high: 21467, low: 21461, close: 21465 },
      { time: "11:30", open: 21465, high: 21467, low: 21457, close: 21459 },
      { time: "11:35", open: 21459, high: 21464, low: 21457, close: 21462 },
      { time: "11:40", open: 21462, high: 21464, low: 21431.5, close: 21455 },
      { time: "11:45", open: 21455, high: 21457, low: 21426.5, close: 21430 },
      { time: "11:50", open: 21430, high: 21432, low: 21423, close: 21425 },
      { time: "11:55", open: 21425, high: 21427, low: 21419, close: 21421 },
      // Candle 30 — body closes below the gap low — flips to an IFVG (resistance)
      { time: "12:00", open: 21421, high: 21423, low: 21413, close: 21415 },
      // Candle 31 — retest chop, no decisive close
      { time: "12:05", open: 21415, high: 21420, low: 21413, close: 21418 },
      // Candle 32 — still chopping
      { time: "12:10", open: 21418, high: 21459.5, low: 21414, close: 21416 },
      // Candle 33 — closes back above the gap high — DISRESPECTED
      { time: "12:15", open: 21416, high: 21463, low: 21414, close: 21461 },
      { time: "12:20", open: 21461, high: 21468, low: 21459, close: 21466 },
      { time: "12:25", open: 21466, high: 21468, low: 21461, close: 21463 },
      { time: "12:30", open: 21463, high: 21471, low: 21461, close: 21469 },
      { time: "12:35", open: 21469, high: 21471, low: 21465, close: 21467 },
      { time: "12:40", open: 21467, high: 21474, low: 21465, close: 21472 },
      { time: "12:45", open: 21472, high: 21474, low: 21467, close: 21469 },
    ],
  },
  // guided-001: clear bullish setup. Structure: an untouched swing high at
  // 21445 sits above everything that follows (never revisited — the target).
  // Price sweeps the prior swing low (21300, candle 5) down to a new low at
  // 21280 (candle 12 — sell-side liquidity taken, the setup's swing low),
  // then candle 15 closes at 21418, back above the lower high at 21415
  // (candle 9) — a confirmed bullish MSS. That same displacement leaves a
  // Fair Value Gap at [21328, 21350] (candles 14-16), retested at candle 19.
  // Entry 21335 / stop 21275 / target 21470 -> R:R = (21470-21335)/(21335-21275)
  // = 135/60 = 2.25, clearing the 2:1 minimum.
  {
    exercise_id: "guided-001",
    concept: "GuidedEntry",
    answer_type: "guided",
    answerLabel: "a valid trade setup",
    prompt: "Work through the setup: bias, entry, stop, and target.",
    instrument: "NQ (prototype data)",
    timeframe: "5m",
    difficulty: 1,
    explanation:
      "A valid long setup: bullish MSS with sell-side liquidity taken, an unmitigated FVG for entry, a stop below the setup's swing low, and a target at the next buy-side liquidity — combining for roughly 2.25:1, clearing the 2:1 minimum.",
    answer: {
      bias: "bullish",
      entry: { price: 21335, tolerance: 8 },
      stop: { price: 21275, tolerance: 8 },
      target: { price: 21470, tolerance: 6 },
      min_rr: 2,
      is_valid_setup: true,
      step_explanations: {
        bias:
          "Price swept below the prior swing low around 21,300 (down to 21,280) — taking the resting sell-side liquidity there — then reversed and closed back above the most recent lower high near 21,415. A liquidity sweep followed by a structural break the other way is a confirmed bullish Market Structure Shift.",
        entry:
          "The reversal candle that broke structure left a Fair Value Gap between about 21,328 and 21,350. Price pulled back into that unfilled range before continuing higher — an unmitigated FVG is exactly the kind of level this framework enters from.",
        stop:
          "The idea is invalidated if price trades back below the swing low that formed the setup, around 21,280. The stop sits just beyond that level.",
        target:
          "The next resting buy-side liquidity above is the untouched swing high from earlier in the session, around 21,470 — price hasn't traded back up to test it yet.",
      },
      overall_explanation:
        "A valid long setup: bullish MSS with sell-side liquidity taken, an unmitigated FVG for entry, a stop below the setup's swing low, and a target at the next buy-side liquidity — combining for roughly 2.25:1, clearing the 2:1 minimum.",
    },
    candles: [
      { time: "09:30", open: 21430, high: 21470, low: 21425, close: 21460 },
      { time: "09:35", open: 21460, high: 21462, low: 21430, close: 21435 },
      { time: "09:40", open: 21435, high: 21438, low: 21395, close: 21400 },
      { time: "09:45", open: 21400, high: 21405, low: 21360, close: 21365 },
      { time: "09:50", open: 21365, high: 21370, low: 21330, close: 21335 },
      // Candle 5 — Prior Low (sell-side liquidity pool) = 21300
      { time: "09:55", open: 21335, high: 21340, low: 21300, close: 21305 },
      { time: "10:00", open: 21305, high: 21340, low: 21300, close: 21335 },
      { time: "10:05", open: 21335, high: 21375, low: 21330, close: 21370 },
      { time: "10:10", open: 21370, high: 21410, low: 21365, close: 21405 },
      // Candle 9 — Lower High (the swing whose break confirms the MSS) = 21415
      { time: "10:15", open: 21405, high: 21415, low: 21395, close: 21400 },
      { time: "10:20", open: 21400, high: 21402, low: 21360, close: 21365 },
      { time: "10:25", open: 21365, high: 21368, low: 21320, close: 21325 },
      // Candle 12 — sweeps below the Prior Low, new setup swing low = 21280
      { time: "10:30", open: 21325, high: 21330, low: 21280, close: 21285 },
      { time: "10:35", open: 21285, high: 21315, low: 21282, close: 21310 },
      // Candle 14 — FVG candle 1 (high 21328)
      { time: "10:40", open: 21310, high: 21328, low: 21305, close: 21322 },
      // Candle 15 — displacement; close 21418 confirms the MSS (>21415)
      { time: "10:45", open: 21322, high: 21422, low: 21320, close: 21418 },
      // Candle 16 — FVG candle 3 (low 21350) confirms the gap [21328, 21350]
      { time: "10:50", open: 21418, high: 21430, low: 21350, close: 21425 },
      { time: "10:55", open: 21425, high: 21432, low: 21400, close: 21405 },
      { time: "11:00", open: 21405, high: 21408, low: 21370, close: 21378 },
      // Candle 19 — retests the FVG zone (low 21345)
      { time: "11:05", open: 21378, high: 21382, low: 21345, close: 21355 },
      { time: "11:10", open: 21355, high: 21400, low: 21350, close: 21395 },
      { time: "11:15", open: 21395, high: 21430, low: 21390, close: 21425 },
      { time: "11:20", open: 21425, high: 21460, low: 21420, close: 21455 },
      { time: "11:25", open: 21455, high: 21468, low: 21448, close: 21460 },
      { time: "11:30", open: 21460, high: 21472, low: 21455, close: 21468 },
      { time: "11:35", open: 21468, high: 21475, low: 21460, close: 21470 },
      { time: "11:40", open: 21470, high: 21478, low: 21462, close: 21465 },
      { time: "11:45", open: 21465, high: 21470, low: 21450, close: 21455 },
      { time: "11:50", open: 21455, high: 21460, low: 21440, close: 21445 },
      { time: "11:55", open: 21445, high: 21450, low: 21430, close: 21435 },
      { time: "12:00", open: 21435, high: 21440, low: 21420, close: 21425 },
      { time: "12:05", open: 21425, high: 21432, low: 21415, close: 21420 },
      { time: "12:10", open: 21420, high: 21428, low: 21410, close: 21415 },
      { time: "12:15", open: 21415, high: 21422, low: 21405, close: 21410 },
      { time: "12:20", open: 21410, high: 21418, low: 21400, close: 21405 },
      { time: "12:25", open: 21405, high: 21412, low: 21395, close: 21400 },
      { time: "12:30", open: 21400, high: 21408, low: 21390, close: 21395 },
      { time: "12:35", open: 21395, high: 21402, low: 21385, close: 21390 },
      { time: "12:40", open: 21390, high: 21398, low: 21380, close: 21385 },
      { time: "12:45", open: 21385, high: 21392, low: 21378, close: 21382 },
    ],
  },
  // guided-002: bearish mirror of guided-001. An untouched swing low at
  // 21230 sits below everything that follows. Price sweeps the prior swing
  // high (21400, candle 5) up to a new high at 21420 (candle 12 —
  // buy-side liquidity taken), then candle 15 closes at 21282, back below
  // the higher low at 21285 (candle 9) — a confirmed bearish MSS. That
  // displacement leaves a bearish Fair Value Gap at [21350, 21372]
  // (candles 14-16), retested at candles 18-19. Entry 21365 / stop 21425 /
  // target 21230 -> R:R = (21365-21230)/(21425-21365) = 135/60 = 2.25.
  {
    exercise_id: "guided-002",
    concept: "GuidedEntry",
    answer_type: "guided",
    answerLabel: "a valid trade setup",
    prompt: "Work through the setup: bias, entry, stop, and target.",
    instrument: "NQ (prototype data)",
    timeframe: "5m",
    difficulty: 1,
    explanation:
      "A valid short setup: bearish MSS with buy-side liquidity taken, an unmitigated FVG for entry, a stop above the setup's swing high, and a target at the next sell-side liquidity — combining for roughly 2.25:1.",
    answer: {
      bias: "bearish",
      entry: { price: 21365, tolerance: 8 },
      stop: { price: 21425, tolerance: 8 },
      target: { price: 21230, tolerance: 6 },
      min_rr: 2,
      is_valid_setup: true,
      step_explanations: {
        bias:
          "Price swept above the prior swing high around 21,400 (up to 21,420) — taking the resting buy-side liquidity there — then reversed and closed back below the most recent higher low near 21,285. A liquidity sweep followed by a structural break the other way is a confirmed bearish Market Structure Shift.",
        entry:
          "The reversal candle that broke structure left a Fair Value Gap between about 21,350 and 21,372. Price pulled back up into that unfilled range before continuing lower — an unmitigated FVG, mirrored for the short side.",
        stop:
          "The idea is invalidated if price trades back above the swing high that formed the setup, around 21,420. The stop sits just beyond that level.",
        target:
          "The next resting sell-side liquidity below is the untouched swing low from earlier in the session, around 21,230 — price hasn't traded back down to test it yet.",
      },
      overall_explanation:
        "A valid short setup: bearish MSS with buy-side liquidity taken, an unmitigated FVG for entry, a stop above the setup's swing high, and a target at the next sell-side liquidity — combining for roughly 2.25:1, clearing the 2:1 minimum.",
    },
    candles: [
      { time: "09:30", open: 21270, high: 21275, low: 21230, close: 21240 },
      { time: "09:35", open: 21240, high: 21275, low: 21238, close: 21270 },
      { time: "09:40", open: 21270, high: 21310, low: 21265, close: 21305 },
      { time: "09:45", open: 21305, high: 21345, low: 21300, close: 21340 },
      { time: "09:50", open: 21340, high: 21375, low: 21335, close: 21370 },
      // Candle 5 — Prior High (buy-side liquidity pool) = 21400
      { time: "09:55", open: 21370, high: 21400, low: 21365, close: 21395 },
      { time: "10:00", open: 21395, high: 21400, low: 21360, close: 21365 },
      { time: "10:05", open: 21365, high: 21370, low: 21325, close: 21330 },
      { time: "10:10", open: 21330, high: 21335, low: 21290, close: 21295 },
      // Candle 9 — Higher Low (the swing whose break confirms the MSS) = 21285
      { time: "10:15", open: 21295, high: 21300, low: 21285, close: 21290 },
      { time: "10:20", open: 21290, high: 21330, low: 21288, close: 21325 },
      { time: "10:25", open: 21325, high: 21365, low: 21322, close: 21360 },
      // Candle 12 — sweeps above the Prior High, new setup swing high = 21420
      { time: "10:30", open: 21360, high: 21420, low: 21358, close: 21415 },
      { time: "10:35", open: 21415, high: 21418, low: 21385, close: 21390 },
      // Candle 14 — FVG candle 1 (low 21372)
      { time: "10:40", open: 21390, high: 21395, low: 21372, close: 21378 },
      // Candle 15 — displacement; close 21282 confirms the MSS (<21285)
      { time: "10:45", open: 21378, high: 21380, low: 21278, close: 21282 },
      // Candle 16 — FVG candle 3 (high 21350) confirms the gap [21350, 21372]
      { time: "10:50", open: 21282, high: 21350, low: 21275, close: 21290 },
      { time: "10:55", open: 21290, high: 21340, low: 21285, close: 21335 },
      // Candle 18-19 — retest the FVG zone (high 21365-21372)
      { time: "11:00", open: 21335, high: 21365, low: 21330, close: 21360 },
      { time: "11:05", open: 21360, high: 21372, low: 21355, close: 21358 },
      { time: "11:10", open: 21358, high: 21362, low: 21320, close: 21325 },
      { time: "11:15", open: 21325, high: 21330, low: 21290, close: 21295 },
      { time: "11:20", open: 21295, high: 21300, low: 21260, close: 21265 },
      { time: "11:25", open: 21265, high: 21270, low: 21235, close: 21240 },
      { time: "11:30", open: 21240, high: 21245, low: 21228, close: 21232 },
      { time: "11:35", open: 21232, high: 21238, low: 21225, close: 21230 },
      { time: "11:40", open: 21230, high: 21240, low: 21222, close: 21235 },
      { time: "11:45", open: 21235, high: 21245, low: 21230, close: 21240 },
      { time: "11:50", open: 21240, high: 21250, low: 21235, close: 21245 },
      { time: "11:55", open: 21245, high: 21255, low: 21240, close: 21250 },
      { time: "12:00", open: 21250, high: 21260, low: 21245, close: 21255 },
      { time: "12:05", open: 21255, high: 21262, low: 21248, close: 21258 },
      { time: "12:10", open: 21258, high: 21266, low: 21252, close: 21262 },
      { time: "12:15", open: 21262, high: 21270, low: 21256, close: 21266 },
      { time: "12:20", open: 21266, high: 21274, low: 21260, close: 21270 },
      { time: "12:25", open: 21270, high: 21278, low: 21264, close: 21274 },
      { time: "12:30", open: 21274, high: 21282, low: 21268, close: 21278 },
      { time: "12:35", open: 21278, high: 21286, low: 21272, close: 21282 },
      { time: "12:40", open: 21282, high: 21290, low: 21276, close: 21286 },
      { time: "12:45", open: 21286, high: 21294, low: 21280, close: 21290 },
    ],
  },
  // guided-003: same bullish structure as guided-001 (Prior Low 21300,
  // setup swing low 21280, lower high 21415, FVG [21328, 21350], entry
  // 21335, stop 21275) but the only untouched liquidity above sits close
  // by, at 21445 (candle 0 — above the post-MSS rally's high of 21430, so
  // it's never actually touched, but not far enough away to matter). R:R =
  // (21445-21335)/(21335-21275) = 110/60 = 1.83 — every part of the read is
  // right, but it doesn't clear 2:1. is_valid_setup is false on R:R alone.
  {
    exercise_id: "guided-003",
    concept: "GuidedEntry",
    answer_type: "guided",
    answerLabel: "a valid trade setup",
    prompt: "Work through the setup: bias, entry, stop, and target.",
    instrument: "NQ (prototype data)",
    timeframe: "5m",
    difficulty: 2,
    explanation:
      "Every piece of the structure here is real — the bullish MSS, the FVG entry, the stop below the setup's swing low — but the only liquidity resting above is close enough that the trade only reaches about 1.8:1. That's below the 2:1 minimum, so the correct call is no trade, even though nothing about the read itself was wrong.",
    answer: {
      bias: "bullish",
      entry: { price: 21335, tolerance: 8 },
      stop: { price: 21275, tolerance: 8 },
      target: { price: 21445, tolerance: 6 },
      min_rr: 2,
      is_valid_setup: false,
      step_explanations: {
        bias:
          "Price swept below the prior swing low around 21,300 (down to 21,280) — taking the resting sell-side liquidity there — then reversed and closed back above the most recent lower high near 21,415. That's a confirmed bullish Market Structure Shift.",
        entry:
          "The reversal candle that broke structure left a Fair Value Gap between about 21,328 and 21,350 — an unmitigated FVG, retested before price continued higher.",
        stop:
          "The idea is invalidated below the swing low that formed the setup, around 21,280. The stop sits just beyond that level.",
        target:
          "The next visible resting buy-side liquidity above is a swing high around 21,445 — closer to entry than it looks at first glance.",
      },
      overall_explanation:
        "Every piece of the structure here is real — the bullish MSS, the FVG entry, the stop below the setup's swing low — but the only liquidity resting above is close enough that the trade only reaches about 1.8:1. That's below the 2:1 minimum, so the correct call is no trade, even though nothing about the read itself was wrong.",
    },
    candles: [
      // Candle 0 — the only untouched liquidity above = 21445
      { time: "09:30", open: 21435, high: 21445, low: 21425, close: 21430 },
      { time: "09:35", open: 21430, high: 21432, low: 21400, close: 21405 },
      { time: "09:40", open: 21405, high: 21408, low: 21375, close: 21380 },
      { time: "09:45", open: 21380, high: 21385, low: 21355, close: 21360 },
      { time: "09:50", open: 21360, high: 21365, low: 21332, close: 21335 },
      // Candle 5 — Prior Low = 21300
      { time: "09:55", open: 21335, high: 21340, low: 21300, close: 21305 },
      { time: "10:00", open: 21305, high: 21340, low: 21300, close: 21335 },
      { time: "10:05", open: 21335, high: 21375, low: 21330, close: 21370 },
      { time: "10:10", open: 21370, high: 21410, low: 21365, close: 21405 },
      // Candle 9 — Lower High = 21415
      { time: "10:15", open: 21405, high: 21415, low: 21395, close: 21400 },
      { time: "10:20", open: 21400, high: 21402, low: 21360, close: 21365 },
      { time: "10:25", open: 21365, high: 21368, low: 21320, close: 21325 },
      // Candle 12 — setup swing low = 21280
      { time: "10:30", open: 21325, high: 21330, low: 21280, close: 21285 },
      { time: "10:35", open: 21285, high: 21315, low: 21282, close: 21310 },
      // Candle 14 — FVG candle 1 (high 21328)
      { time: "10:40", open: 21310, high: 21328, low: 21305, close: 21322 },
      // Candle 15 — displacement; close 21418 confirms the MSS (>21415)
      { time: "10:45", open: 21322, high: 21422, low: 21320, close: 21418 },
      // Candle 16 — FVG candle 3 (low 21350); rally peaks at 21430, still
      // below the 21445 target
      { time: "10:50", open: 21418, high: 21430, low: 21350, close: 21425 },
      { time: "10:55", open: 21425, high: 21432, low: 21400, close: 21405 },
      { time: "11:00", open: 21405, high: 21408, low: 21370, close: 21378 },
      // Candle 19 — retests the FVG zone (low 21345)
      { time: "11:05", open: 21378, high: 21382, low: 21345, close: 21355 },
      { time: "11:10", open: 21355, high: 21400, low: 21350, close: 21395 },
      { time: "11:15", open: 21395, high: 21430, low: 21390, close: 21425 },
      // Candle 22 — approaches but doesn't reach the 21445 target
      { time: "11:20", open: 21425, high: 21440, low: 21420, close: 21430 },
      { time: "11:25", open: 21430, high: 21435, low: 21415, close: 21420 },
      { time: "11:30", open: 21420, high: 21425, low: 21405, close: 21410 },
      { time: "11:35", open: 21410, high: 21415, low: 21398, close: 21402 },
      { time: "11:40", open: 21402, high: 21408, low: 21392, close: 21396 },
      { time: "11:45", open: 21396, high: 21400, low: 21385, close: 21390 },
      { time: "11:50", open: 21390, high: 21395, low: 21378, close: 21382 },
      { time: "11:55", open: 21382, high: 21388, low: 21372, close: 21376 },
      { time: "12:00", open: 21376, high: 21380, low: 21365, close: 21370 },
      { time: "12:05", open: 21370, high: 21375, low: 21360, close: 21365 },
      { time: "12:10", open: 21365, high: 21370, low: 21355, close: 21360 },
      { time: "12:15", open: 21360, high: 21365, low: 21350, close: 21355 },
      { time: "12:20", open: 21355, high: 21360, low: 21345, close: 21350 },
      { time: "12:25", open: 21350, high: 21355, low: 21340, close: 21345 },
      { time: "12:30", open: 21345, high: 21350, low: 21335, close: 21340 },
      { time: "12:35", open: 21340, high: 21345, low: 21330, close: 21335 },
      { time: "12:40", open: 21335, high: 21340, low: 21325, close: 21330 },
      { time: "12:45", open: 21330, high: 21335, low: 21320, close: 21325 },
    ],
  },
  // guided-004: choppy, range-bound price action — no sweep-then-reversal,
  // no sequence of higher-highs/higher-lows or lower-highs/lower-lows, and
  // no qualifying Fair Value Gap anywhere (every candle's range overlaps
  // generously with its neighbors, so no 3-candle imbalance forms). There's
  // nothing to build a bias from, so entry/stop/target don't exist either.
  {
    exercise_id: "guided-004",
    concept: "GuidedEntry",
    answer_type: "guided",
    answerLabel: "a valid trade setup",
    prompt: "Work through the setup: bias, entry, stop, and target.",
    instrument: "NQ (prototype data)",
    timeframe: "5m",
    difficulty: 2,
    explanation:
      "This chart never confirms a Market Structure Shift in either direction — it's just chop. With bias unclear, there's no valid entry level, no stop, and no target. The correct call is no trade.",
    answer: {
      bias: "unclear",
      entry: null,
      stop: null,
      target: null,
      min_rr: 2,
      is_valid_setup: false,
      step_explanations: {
        bias:
          "Price is chopping sideways with no clear sequence of higher highs/higher lows or lower highs/lower lows, and no liquidity sweep followed by a structural break in either direction. There's no confirmed Market Structure Shift here — bias is unclear.",
        entry:
          "With no clear bias, there's no direction to look for a valid entry level in — nothing here qualifies as an unmitigated FVG, an IFVG, or a broken structural level worth retesting.",
        stop:
          "No entry means no stop-loss reference — there's no swing point this idea would be built around.",
        target:
          "No entry means no target either — there's nothing to measure a reward against.",
      },
      overall_explanation:
        "This chart never confirms a Market Structure Shift in either direction — it's just chop. With bias unclear, there's no valid entry level, no stop, and no target. The correct call is no trade.",
    },
    candles: [
      { time: "09:30", open: 21350, high: 21362, low: 21344, close: 21358 },
      { time: "09:35", open: 21358, high: 21365, low: 21348, close: 21352 },
      { time: "09:40", open: 21352, high: 21360, low: 21338, close: 21344 },
      { time: "09:45", open: 21344, high: 21356, low: 21335, close: 21350 },
      { time: "09:50", open: 21350, high: 21368, low: 21345, close: 21362 },
      { time: "09:55", open: 21362, high: 21370, low: 21350, close: 21355 },
      { time: "10:00", open: 21355, high: 21362, low: 21340, close: 21346 },
      { time: "10:05", open: 21346, high: 21358, low: 21332, close: 21352 },
      { time: "10:10", open: 21352, high: 21366, low: 21346, close: 21360 },
      { time: "10:15", open: 21360, high: 21372, low: 21352, close: 21356 },
      { time: "10:20", open: 21356, high: 21364, low: 21340, close: 21345 },
      { time: "10:25", open: 21345, high: 21358, low: 21332, close: 21350 },
      { time: "10:30", open: 21350, high: 21368, low: 21344, close: 21362 },
      { time: "10:35", open: 21362, high: 21374, low: 21354, close: 21358 },
      { time: "10:40", open: 21358, high: 21366, low: 21344, close: 21350 },
      { time: "10:45", open: 21350, high: 21362, low: 21336, close: 21344 },
      { time: "10:50", open: 21344, high: 21356, low: 21328, close: 21340 },
      { time: "10:55", open: 21340, high: 21352, low: 21324, close: 21348 },
      { time: "11:00", open: 21348, high: 21364, low: 21338, close: 21358 },
      { time: "11:05", open: 21358, high: 21370, low: 21348, close: 21354 },
      { time: "11:10", open: 21354, high: 21362, low: 21340, close: 21346 },
      { time: "11:15", open: 21346, high: 21358, low: 21332, close: 21352 },
      { time: "11:20", open: 21352, high: 21366, low: 21344, close: 21360 },
      { time: "11:25", open: 21360, high: 21372, low: 21350, close: 21356 },
      { time: "11:30", open: 21356, high: 21364, low: 21342, close: 21348 },
      { time: "11:35", open: 21348, high: 21360, low: 21334, close: 21352 },
      { time: "11:40", open: 21352, high: 21368, low: 21344, close: 21362 },
      { time: "11:45", open: 21362, high: 21374, low: 21352, close: 21358 },
      { time: "11:50", open: 21358, high: 21366, low: 21346, close: 21350 },
      { time: "11:55", open: 21350, high: 21362, low: 21338, close: 21344 },
      { time: "12:00", open: 21344, high: 21356, low: 21330, close: 21348 },
      { time: "12:05", open: 21348, high: 21360, low: 21336, close: 21354 },
      { time: "12:10", open: 21354, high: 21366, low: 21344, close: 21358 },
      { time: "12:15", open: 21358, high: 21370, low: 21348, close: 21352 },
      { time: "12:20", open: 21352, high: 21362, low: 21340, close: 21346 },
      { time: "12:25", open: 21346, high: 21358, low: 21332, close: 21350 },
      { time: "12:30", open: 21350, high: 21364, low: 21340, close: 21356 },
      { time: "12:35", open: 21356, high: 21368, low: 21346, close: 21360 },
      { time: "12:40", open: 21360, high: 21372, low: 21350, close: 21354 },
      { time: "12:45", open: 21354, high: 21364, low: 21344, close: 21350 },
    ],
  },
  // guided-005: harder valid setup, IFVG entry. An early bearish FVG at
  // [21440, 21470] (candles 3-5) later gets disrespected — candle 16
  // closes at 21475, above its upper boundary — flipping it into an
  // Inverse FVG acting as support. That same candle 16 also closes above
  // the lower high at 21415 (candle 11), confirming a bullish MSS off the
  // setup swing low at 21320 (candle 13, sweeping the prior low at 21340).
  // Price retests the flipped zone at candles 20-22. Entry 21445 / stop
  // 21315 / target 21730 -> R:R = (21730-21445)/(21445-21315) = 285/130 =
  // 2.19.
  {
    exercise_id: "guided-005",
    concept: "GuidedEntry",
    answer_type: "guided",
    answerLabel: "a valid trade setup",
    prompt: "Work through the setup: bias, entry, stop, and target.",
    instrument: "NQ (prototype data)",
    timeframe: "5m",
    difficulty: 3,
    explanation:
      "A valid, if layered, long setup: a bullish MSS with sell-side liquidity taken, entry from a former bearish FVG that failed and flipped into support (an IFVG), a stop below the setup's swing low, and a target at the next buy-side liquidity — combining for roughly 2.2:1.",
    answer: {
      bias: "bullish",
      entry: { price: 21445, tolerance: 10 },
      stop: { price: 21315, tolerance: 8 },
      target: { price: 21730, tolerance: 6 },
      min_rr: 2,
      is_valid_setup: true,
      step_explanations: {
        bias:
          "Price swept the prior swing low around 21,340 down to 21,320, taking the resting sell-side liquidity there, then reversed and closed back above the recent lower high near 21,415. That liquidity sweep plus structural break confirms a bullish Market Structure Shift.",
        entry:
          "Earlier in the chart, a bearish Fair Value Gap sat between about 21,440 and 21,470. The same displacement candle that confirmed the MSS also closed back above that gap's upper boundary — disrespecting it and flipping it into an Inverse Fair Value Gap acting as support. Price later retested that flipped zone and held, which is the entry.",
        stop:
          "The idea is invalidated below the swing low that formed the setup, around 21,320 — the stop sits just beyond it.",
        target:
          "The next resting buy-side liquidity above is the untouched high from earlier in the session, around 21,730.",
      },
      overall_explanation:
        "A valid, if layered, long setup: a bullish MSS with sell-side liquidity taken, entry from a former bearish FVG that failed and flipped into support (an IFVG), a stop below the setup's swing low, and a target at the next buy-side liquidity — combining for roughly 2.2:1, clearing the 2:1 minimum.",
    },
    candles: [
      // Candle 0 — the untouched high above everything that follows = 21730
      { time: "09:30", open: 21650, high: 21730, low: 21640, close: 21660 },
      { time: "09:35", open: 21660, high: 21665, low: 21600, close: 21610 },
      { time: "09:40", open: 21610, high: 21615, low: 21540, close: 21550 },
      { time: "09:45", open: 21550, high: 21555, low: 21500, close: 21505 },
      // Candle 4 — bearish FVG candle 1 (low 21470)
      { time: "09:50", open: 21505, high: 21508, low: 21470, close: 21475 },
      // Candle 5 — displacement down
      { time: "09:55", open: 21475, high: 21478, low: 21400, close: 21405 },
      // Candle 6 — bearish FVG candle 3 (high 21440); gap [21440, 21470]
      { time: "10:00", open: 21405, high: 21440, low: 21395, close: 21400 },
      { time: "10:05", open: 21400, high: 21405, low: 21370, close: 21375 },
      // Candle 8 — Prior Low = 21340
      { time: "10:10", open: 21375, high: 21378, low: 21340, close: 21345 },
      { time: "10:15", open: 21345, high: 21380, low: 21342, close: 21375 },
      { time: "10:20", open: 21375, high: 21410, low: 21370, close: 21405 },
      // Candle 11 — Lower High = 21415
      { time: "10:25", open: 21405, high: 21415, low: 21398, close: 21400 },
      { time: "10:30", open: 21400, high: 21402, low: 21360, close: 21365 },
      // Candle 13 — setup swing low = 21320, sweeps the Prior Low
      { time: "10:35", open: 21365, high: 21368, low: 21320, close: 21325 },
      { time: "10:40", open: 21325, high: 21360, low: 21322, close: 21355 },
      { time: "10:45", open: 21355, high: 21362, low: 21340, close: 21345 },
      // Candle 16 — displacement: close 21475 confirms the MSS (>21415)
      // AND closes above 21470, flipping the bearish FVG into an IFVG
      { time: "10:50", open: 21345, high: 21480, low: 21342, close: 21475 },
      { time: "10:55", open: 21475, high: 21490, low: 21470, close: 21485 },
      { time: "11:00", open: 21485, high: 21495, low: 21478, close: 21490 },
      { time: "11:05", open: 21490, high: 21492, low: 21460, close: 21465 },
      // Candle 20 — dips into the flipped IFVG zone
      { time: "11:10", open: 21465, high: 21468, low: 21445, close: 21450 },
      { time: "11:15", open: 21450, high: 21455, low: 21442, close: 21448 },
      // Candle 22 — touches the zone's bottom (21440) and reverses — entry
      { time: "11:20", open: 21448, high: 21475, low: 21440, close: 21470 },
      { time: "11:25", open: 21470, high: 21500, low: 21465, close: 21495 },
      { time: "11:30", open: 21495, high: 21520, low: 21490, close: 21515 },
      { time: "11:35", open: 21515, high: 21535, low: 21508, close: 21528 },
      { time: "11:40", open: 21528, high: 21550, low: 21520, close: 21542 },
      { time: "11:45", open: 21542, high: 21565, low: 21535, close: 21558 },
      { time: "11:50", open: 21558, high: 21580, low: 21550, close: 21572 },
      { time: "11:55", open: 21572, high: 21595, low: 21565, close: 21588 },
      { time: "12:00", open: 21588, high: 21610, low: 21580, close: 21602 },
      { time: "12:05", open: 21602, high: 21625, low: 21595, close: 21618 },
      { time: "12:10", open: 21618, high: 21640, low: 21610, close: 21632 },
      { time: "12:15", open: 21632, high: 21655, low: 21625, close: 21648 },
      { time: "12:20", open: 21648, high: 21668, low: 21640, close: 21660 },
      { time: "12:25", open: 21660, high: 21680, low: 21652, close: 21672 },
      { time: "12:30", open: 21672, high: 21695, low: 21665, close: 21685 },
      { time: "12:35", open: 21685, high: 21705, low: 21678, close: 21698 },
      { time: "12:40", open: 21698, high: 21718, low: 21690, close: 21710 },
      { time: "12:45", open: 21710, high: 21725, low: 21702, close: 21715 },
    ],
  },
];

// Free Trade scenarios live in their own file (each carries ~80 candles) —
// same Exercise shape, so sessions, attempts, and analytics treat them like
// any other exercise.
// Real-data scenarios (src/data/real-scenarios/) are registered alongside the
// constructed ones — every one carries provenance, and only human-reviewed
// ones are ever offered in practice (see isPracticeReady below).
export const exercises: Exercise[] = [
  ...conceptExercises,
  ...timeLiquidityExercises,
  ...premiumDiscountExercises,
  ...freeTradeScenarios,
  ...realScenarios,
];

/** Constructed exercises are always practice-ready; a real-data scenario
 * only once a human has reviewed it (docs/SCENARIO-VALIDATION.md). */
export function isPracticeReady(exercise: Exercise): boolean {
  return exercise.provenance === undefined || exercise.provenance.human_reviewed === true;
}

export function getExercise(exerciseId: string): Exercise | undefined {
  return exercises.find((exercise) => exercise.exercise_id === exerciseId);
}

/** Only practice-ready exercises — every session is built from this, so an
 * unreviewed real scenario can never be served. getExercise() above stays
 * unfiltered so past attempts still resolve their labels. */
export function getExerciseIdsByConcept(concept: Concept): string[] {
  return exercises
    .filter((exercise) => exercise.concept === concept && isPracticeReady(exercise))
    .map((exercise) => exercise.exercise_id);
}

/** Fixed session-length caps offered in the UI, in addition to "all". */
const SESSION_LENGTH_CAPS = [5, 10] as const;

export type SessionLength = number | "all";

/** Which length choices make sense for a concept — a cap only appears if
 * the concept actually has more exercises than that cap (offering "10"
 * when there are only 5 exercises would just be a second way to ask for
 * "all"). "all" is always offered. */
export function getAvailableSessionLengths(concept: Concept): SessionLength[] {
  const total = getExerciseIdsByConcept(concept).length;
  const caps = SESSION_LENGTH_CAPS.filter((cap) => cap < total);
  return [...caps, "all"];
}

/** Fisher-Yates — used so exercise order within a session isn't always the
 * same fixed sequence the exercises are authored in. */
function shuffle<T>(items: T[]): T[] {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/** Builds a randomly-ordered exercise list for a new session — `length`
 * caps how many exercises are included ("all" uses every exercise for the
 * concept, order still randomized). */
export function buildSessionExerciseIds(concept: Concept, length: SessionLength): string[] {
  const shuffled = shuffle(getExerciseIdsByConcept(concept));
  return length === "all" ? shuffled : shuffled.slice(0, Math.min(length, shuffled.length));
}
