// The scenario engine's vocabulary (docs/ENGINE.md). One reusable training
// engine; every mode is a configuration of it, never a parallel
// implementation:
//
//   scenario        authored chart data + a reference analysis (this file)
//   chart state     which timeframe, how many candles are revealed (candles.ts)
//   annotations     what a trader marks on the chart (Annotation)
//   stage           one question: an input kind, a view, a scorer (ModeConfig)
//   response        what the user did (StageResponse)
//   acceptable      ranges and sets, never a single pixel-perfect answer
//   scoring rule    a scorer that turns a response + the acceptable answers
//                   into a dimension score (scoring.ts)
//   attempt result  the scored whole: dimensions, mistakes, review, outcome
//
// The reference analysis is "one defensible reading", not "the" ICT answer:
// every answer is a set of options with credit, a range with a soft edge, or
// a group of equally valid markings. Nothing in the engine implies a single
// perfect interpretation.

import type { Timeframe } from "@/lib/engine/time";
import type { CandleRow } from "@/lib/engine/candles";
import type { Verdict3 } from "@/lib/verdict";

export type Direction = "long" | "short";
export type Bias = "bullish" | "bearish" | "neutral";
/** "wait" = declined to enter and kept watching; at the end of a scenario it
 * is the recorded decision if the user never committed. */
export type Decision = "long" | "short" | "wait" | "no_trade";

export const SKILLS = [
  "concept_recognition",
  "market_structure",
  "liquidity",
  "htf_bias",
  "entry_models",
  "confluence",
  "execution",
] as const;
export type SkillId = (typeof SKILLS)[number];

export const SKILL_LABEL: Record<SkillId, string> = {
  concept_recognition: "Concept Recognition",
  market_structure: "Market Structure",
  liquidity: "Liquidity",
  htf_bias: "HTF Bias",
  entry_models: "Entry Models",
  confluence: "Confluence",
  execution: "Execution",
};

/** The deliberately messy kinds of chart (docs/ENGINE.md → Content). */
export const SCENARIO_TYPES = [
  "valid_setup",
  "almost_valid",
  "failed_setup",
  "no_trade",
  "conflicting_htf_ltf",
  "multiple_fvgs",
  "internal_external",
  "late_entry",
  "chop",
  "good_structure_bad_location",
  "good_location_no_confirmation",
] as const;
export type ScenarioType = (typeof SCENARIO_TYPES)[number];

export const SCENARIO_TYPE_LABEL: Record<ScenarioType, string> = {
  valid_setup: "Valid setup",
  almost_valid: "Almost valid",
  failed_setup: "Failed setup",
  no_trade: "No-trade environment",
  conflicting_htf_ltf: "HTF and LTF disagree",
  multiple_fvgs: "Several FVGs",
  internal_external: "Internal vs external liquidity",
  late_entry: "Late or extended entry",
  chop: "Chop",
  good_structure_bad_location: "Good structure, bad location",
  good_location_no_confirmation: "Good location, no confirmation",
};

/** The structured mistakes the review names (docs/ENGINE.md → Mistakes). */
export const MISTAKE_IDS = [
  "PREMATURE_ENTRY",
  "AGAINST_HTF_BIAS",
  "CHASED_DISPLACEMENT",
  "WRONG_DRAW",
  "STOP_TOO_TIGHT",
  "IGNORED_OPPOSING_HTF",
  "INTERNAL_EXTERNAL_CONFUSION",
  "FORCED_SETUP",
  "NO_CONFIRMATION",
] as const;
export type MistakeId = (typeof MISTAKE_IDS)[number];

// ---- Annotations --------------------------------------------------------

/** What the markup toolbar can place. `zone` is a plain rectangle; `fvg` and
 * `ob` are the same rectangle with a name. */
export const ANNOTATION_KINDS = [
  "liquidity",
  "zone",
  "fvg",
  "ob",
  "swing_high",
  "swing_low",
  "note",
  "long_position",
  "short_position",
] as const;
export type AnnotationKind = (typeof ANNOTATION_KINDS)[number];

/** A mark on the chart, anchored in price and time (not in pixels or candle
 * indices), so it means the same thing on every timeframe. */
export type Annotation = {
  id: string;
  kind: AnnotationKind;
  /** liquidity: the level. swing_*: the extreme. note: where it sits. */
  price?: number;
  /** zone / fvg / ob. */
  priceLow?: number;
  priceHigh?: number;
  /** liquidity / swing / note: the time the mark is anchored at. */
  t?: number;
  /** zone / fvg / ob / position: the time span. */
  tStart?: number;
  tEnd?: number;
  /** long_position / short_position. */
  entry?: number;
  stop?: number;
  target?: number;
  text?: string;
  /** The timeframe it was drawn on (informational). */
  tf?: Timeframe;
  /** Stream cursor (candles revealed) when it was drawn. */
  drawnAt?: number;
  /** Drawn while rewound behind candles the user had already seen ahead of:
   * it was not read at the time, so scoring ignores it. */
  hindsight?: boolean;
};

export type RefRole =
  /** The structure the idea rests on. Missing it costs the most. */
  | "key"
  /** An equally defensible alternative (several valid markings). */
  | "valid"
  /** Real and helpful, not essential. */
  | "supporting"
  /** Real on the chart but does not matter for this decision. */
  | "irrelevant"
  /** Looks valid and is not: marking it as the basis of a trade is a mistake. */
  | "trap"
  /** Structure that weakens or invalidates the idea (opposing HTF liquidity). */
  | "invalidating";

/** A reference marking: one defensible reading of the chart, with how close
 * a user's mark must be to count. */
export type RefAnnotation = {
  id: string;
  kind: AnnotationKind;
  role: RefRole;
  label: string;
  price?: number;
  priceLow?: number;
  priceHigh?: number;
  t?: number;
  tStart?: number;
  tEnd?: number;
  /** How far a user's price may sit from this and still match, in points. */
  priceTolerance?: number;
  /** For point and line marks: how far in time, in minutes. */
  timeTolerance?: number;
  /** Equally valid alternatives share a group; matching `minInGroup` (default
   * 1) of them satisfies it. */
  group?: string;
  minInGroup?: number;
  /** Internal liquidity (inside the range) vs external (beyond it): the
   * difference confuses a lot of traders, so it is tagged. */
  scope?: "internal" | "external";
  /** Only drawable once this many stream candles have been revealed. */
  visibleAtRevealed?: number;
  /** Shown to the user as a numbered candidate to judge ("does this matter?")
   * instead of waiting for them to find it. */
  candidate?: boolean;
  /** Why this reading is reasonable. */
  why: string;
  /** When there are several candidates: why this one and not the other. */
  whyNot?: string;
  /** For advanced readers: how this changes the decision. They are never
   * shown a definition; they get this. */
  decisionNote?: string;
};

// ---- Acceptable answers -------------------------------------------------

export type AcceptableOption<T extends string = string> = { value: T; credit: number; note?: string };

/** Several valid answers, each with credit: 1 is fully valid, between 0 and 1
 * is defensible, 0 is wrong. Anything not listed is wrong. */
export type AcceptableSet<T extends string = string> = { options: AcceptableOption<T>[]; why: string };

/** A price band that is acceptable, with a soft edge: inside earns full
 * credit, a near miss within `soft` points earns graduated partial credit,
 * further out earns none. */
export type AcceptableRange = {
  low: number;
  high: number;
  soft: number;
  label: string;
  /** Credit for inside the range (default 1): a second-best area can be
   * valid at less than full credit. */
  credit?: number;
  /** The textbook point inside the band, drawn in the review. */
  ideal?: number;
};

export type ConfluenceRef = {
  id: string;
  label: string;
  /** strongest: the main reason. supporting: helps. irrelevant: on the chart
   * but changes nothing. misleading: looks supportive and is not. */
  relevance: "strongest" | "supporting" | "irrelevant" | "misleading";
  why: string;
};

export type TradeReference = {
  direction: Direction;
  /** Acceptable entry areas. More than one is normal (the FVG body, or the
   * order block under it). */
  entry: AcceptableRange[];
  /** Stream candle at/after which an entry counts as confirmed: the number of
   * candles that must be revealed (the confirming candle has closed). Null
   * when the setup never confirms. */
  confirmedAtRevealed: number | null;
  confirmationLabel: string | null;
  /** The level whose break proves the idea wrong, and how much room beyond it
   * is still a clean stop. */
  stop: { invalidation: number; buffer: number };
  /** Acceptable targets, any of which is a defensible draw. */
  targets: AcceptableRange[];
  minRR: number;
};

export type ReferenceAnalysis = {
  /** Bias on the higher timeframe. Neutral is a real answer. */
  bias: AcceptableSet<Bias>;
  biasTimeframe: Timeframe;
  /** What to do: long, short, wait, no_trade — several can be defensible. */
  decision: AcceptableSet<Decision>;
  /** Other single-answer questions modes ask, by key ("draw", "location",
   * "alignment", "take"…). */
  answers: Record<string, AcceptableSet>;
  annotations: RefAnnotation[];
  confluences: ConfluenceRef[];
  /** Acceptable price ranges modes ask for ("expected_target"…). */
  ranges: Record<string, AcceptableRange[]>;
  /** The premium/discount frame, when the scenario uses one. */
  dealingRange: { high: number; low: number; tf: Timeframe } | null;
  /** Null when no trade is defensible. */
  trade: TradeReference | null;
  /** What to look for next time, in a trader's words. */
  lookFor: string[];
  /** The overall read, shown first in review. */
  summary: string;
};

// ---- Scenario -----------------------------------------------------------

export type ScenarioProvenance =
  | { kind: "seeded"; note: string; generator: string }
  | { kind: "real"; source: string; reviewed: boolean };

/** Named cursor positions (stream candles revealed) staged modes jump
 * between: the moment of reading, the area being reached, confirmation. */
export type Checkpoints = Record<string, number>;

export type Scenario = {
  id: string;
  title: string;
  /** Intermediate and advanced content carries 2 and 3; 1 is foundation. */
  difficulty: 1 | 2 | 3;
  type: ScenarioType;
  instrument: string;
  provenance: ScenarioProvenance;
  /** What the scenario trains, 0-1 weight each (drives skill evidence and
   * the weakness selector). */
  skills: Partial<Record<SkillId, number>>;
  /** Concept tags for the mastery tree and the setup library. */
  tags: string[];
  /** The decision moment: stream candles revealed when the user first sees it. */
  cursorStart: number;
  checkpoints: Checkpoints;
  data: {
    streamTimeframe: Timeframe;
    history: Partial<Record<Timeframe, CandleRow[]>>;
    stream: CandleRow[];
  };
  reference: ReferenceAnalysis;
  /** Mistakes that taking a given bad decision demonstrates in this
   * scenario, authored (the engine adds the ones it can compute). */
  trapMistakes: Partial<Record<Decision, MistakeId[]>>;
  /** Free-text intros shown to different experience levels. */
  intro: { beginner: string; advanced: string };
  /** "Why not the other one?" notes when several candidates exist. */
  whyNot: { label: string; why: string }[];
  /** One-line, answer-free prompt. */
  prompt: string;
};

/** What the browser may see before an attempt ends: no reference analysis,
 * no future candles beyond what has been revealed. */
export type PublicScenario = {
  id: string;
  title: string;
  difficulty: 1 | 2 | 3;
  instrument: string;
  seeded: boolean;
  cursorStart: number;
  streamTimeframe: Timeframe;
  history: Partial<Record<Timeframe, CandleRow[]>>;
  /** Stream candles up to (and not past) `revealed`. */
  stream: CandleRow[];
  checkpoints: Checkpoints;
  prompt: string;
  intro: { beginner: string; advanced: string };
  /** The confluence checklist (labels only: relevance stays on the server). */
  confluenceOptions: { id: string; label: string }[];
  /** Structures shown for judging in false-positive training. */
  candidates: { id: string; label: string; kind: AnnotationKind; priceLow?: number; priceHigh?: number; price?: number; t?: number; tStart?: number; tEnd?: number }[];
};

// ---- Modes, stages, responses ------------------------------------------

export type ModeId =
  | "simulator"
  | "build_your_bias"
  | "htf_to_ltf"
  | "confluence"
  | "setup_or_trap"
  | "find_everything"
  | "blind_chart"
  | "false_positive"
  | "placement";

export type InputSpec =
  | { kind: "choice"; options: { value: string; label: string }[] }
  | { kind: "multi"; options: "confluences" | "candidates"; min?: number }
  | { kind: "mark"; tools: AnnotationKind[]; refKinds: AnnotationKind[]; roles?: RefRole[]; allowNone?: boolean }
  | { kind: "price"; side?: "target" | "entry" }
  | { kind: "trade"; allowNoTrade: boolean }
  /** playback false: the decision is made at the checkpoint and nothing
   * advances (Blind Chart); true: candles reveal until the trade resolves. */
  | { kind: "replay"; playback: boolean };

/** One question. Stages are data; the runner and the scorers interpret them. */
export type StageConfig = {
  id: string;
  title: string;
  prompt: string;
  /** Timeframes selectable on this stage, and which opens first. */
  timeframes: Timeframe[];
  initialTimeframe: Timeframe;
  /** Which named checkpoint the chart shows (default "start"). */
  checkpoint?: string;
  input: InputSpec;
  /** What the answer is scored against. */
  scorer: ScorerId;
  /** Key into reference.answers / reference.ranges, where the scorer needs one. */
  answerKey?: string;
  /** The dimension a generic scorer (answer_set, price_range, marks_*) reports. */
  dimension?: Dimension;
  optional?: boolean;
  /** Whether the toolbar/guides name the concept (Blind Chart turns this off). */
  guidance: "full" | "minimal" | "none";
};

export type ScorerId =
  | "bias"
  | "answer_set"
  | "decision"
  | "marks_liquidity"
  | "marks_poi"
  | "marks_all"
  | "marks_filter"
  | "price_range"
  | "confluence"
  | "candidates"
  | "trade"
  | "replay";

export type ModeConfig = {
  id: ModeId;
  name: string;
  summary: string;
  stages: StageConfig[];
  /** Whether the scenario's reference trade may be revealed per stage (never) —
   * feedback is at the end so a later stage cannot be answered with hindsight. */
  feedback: "end";
  /** Asks a 1-5 confidence rating at submission. */
  asksConfidence: boolean;
  /** Replaces the default process weights for this mode (config.ts). */
  weights?: Partial<Record<Dimension, number>>;
  /** Skills this mode mainly trains, for recommendations. */
  trains: SkillId[];
  /** Preferred scenario types for the weakness selector. */
  scenarioTypes?: ScenarioType[];
};

export type Order = {
  direction: Direction;
  /** null: at market, filling at the open of the next candle. */
  entry: number | null;
  stop: number;
  target: number;
  /** Candles revealed when the order was placed. */
  placedAt: number;
};

export type ReplayResponse = {
  kind: "replay";
  annotations: Annotation[];
  bias: Bias | null;
  decision: Decision;
  order: Order | null;
  /** How many times the user chose Wait before committing. */
  waits: number;
  /** The most candles the user had seen when they committed. */
  decidedAtRevealed: number;
};

export type TradeResponse = {
  kind: "trade";
  decision: Decision;
  order: Order | null;
};

export type StageResponse =
  | { kind: "choice"; value: string }
  | { kind: "multi"; values: string[] }
  | { kind: "mark"; annotations: Annotation[] }
  | { kind: "price"; price: number }
  | TradeResponse
  | ReplayResponse;

export type Confidence5 = 1 | 2 | 3 | 4 | 5;

export type AttemptResponse = {
  scenarioId: string;
  modeId: ModeId;
  stages: Record<string, StageResponse>;
  confidence: Confidence5 | null;
  responseTimeMs: number;
};

// ---- Results ------------------------------------------------------------

export const DIMENSIONS = [
  "htf_bias",
  "liquidity_read",
  "poi_selection",
  "entry_location",
  "confirmation",
  "stop_placement",
  "target_selection",
  "trade_selection",
  // Modes other than the full simulator score these too.
  "confluence_selection",
  "annotation_filter",
  "annotation_coverage",
] as const;
export type Dimension = (typeof DIMENSIONS)[number];

export const DIMENSION_LABEL: Record<Dimension, string> = {
  htf_bias: "HTF Bias",
  liquidity_read: "Liquidity Read",
  poi_selection: "POI Selection",
  entry_location: "Entry Location",
  confirmation: "Confirmation",
  stop_placement: "Stop Placement",
  target_selection: "Target Selection",
  trade_selection: "Trade Selection",
  confluence_selection: "Confluence Selection",
  annotation_filter: "Does it matter?",
  annotation_coverage: "Finding structure",
};

export type DimensionResult = {
  dimension: Dimension;
  /** Excluded from the total when false (nothing to score). */
  applicable: boolean;
  /** 0-100. */
  score: number;
  verdict: Verdict3;
  /** One trader-worded sentence. */
  note: string;
};

export type FillResult = "market" | "limit" | "stop";

export type TradeOutcome =
  | {
      status: "no_order";
    }
  | {
      status: "unfilled";
      reason: "target_first" | "invalidated" | "scenario_end";
      /** Stream index where it was cancelled, if it was. */
      endIndex: number;
    }
  | {
      status: "closed";
      exit: "stop" | "target" | "scenario_end";
      fillIndex: number;
      fillPrice: number;
      fillType: FillResult;
      exitIndex: number;
      exitPrice: number;
      /** Result in R: (exit - entry) / (entry - stop), signed for direction. */
      resultR: number;
      /** Planned reward-to-risk from the fill. */
      plannedRR: number;
      /** Worst and best excursion while in the trade, in R. */
      maeR: number;
      mfeR: number;
      /** Candles in the trade. */
      bars: number;
      /** The finest candle size the path was checked at. */
      granularity: Timeframe;
    };

export type MatchedMark = { user: Annotation; ref: RefAnnotation; credit: number };

export type MarkComparison = {
  matched: MatchedMark[];
  /** Key or valid-group references nothing matched. */
  missed: RefAnnotation[];
  /** Marks on real structure that does not matter here. */
  irrelevant: { user: Annotation; ref: RefAnnotation }[];
  /** Marks on structure that looks valid and is not. */
  trapped: { user: Annotation; ref: RefAnnotation }[];
  /** Marks matching nothing in the reference. */
  unmatched: Annotation[];
  /** Reference marks that weakened or invalidated the idea. */
  invalidating: RefAnnotation[];
};

export type ReviewBuckets = {
  readCorrectly: string[];
  missed: string[];
  presentButIrrelevant: string[];
  weakenedSetup: string[];
  lookForNextTime: string[];
};

export type SkillEvidence = { skill: SkillId; score: number; weight: number };

export type AttemptResult = {
  scenarioId: string;
  modeId: ModeId;
  /** 0-100, process only. The R result never enters it. */
  score: number;
  verdict: Verdict3;
  dimensions: DimensionResult[];
  /** Which caps held the score down, in words. */
  caps: string[];
  mistakes: MistakeId[];
  outcome: TradeOutcome;
  marks: MarkComparison | null;
  review: ReviewBuckets;
  skillEvidence: SkillEvidence[];
  confidence: Confidence5 | null;
  /** The user avoided a chart where nothing was worth trading. */
  correctAvoidance: boolean | null;
  /** The scenario had no defensible trade. */
  noTradeScenario: boolean;
};
