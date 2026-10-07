// Every tunable number the engine scores with, in one place. Weights, caps
// and tolerances are first guesses chosen so behaviour is explainable
// (docs/ENGINE.md → Scoring); change them here and nowhere else. Tests assert
// behaviour at these defaults, not the numbers themselves.

import type { Dimension, MistakeId, SkillId } from "@/lib/engine/types";

/** Process-score weights for the full simulator. Applicable dimensions are
 * renormalised, so a scenario with no trade defensible is scored on the
 * dimensions that exist for it. */
export const DIMENSION_WEIGHTS: Record<Dimension, number> = {
  htf_bias: 15,
  liquidity_read: 15,
  poi_selection: 14,
  entry_location: 14,
  confirmation: 10,
  stop_placement: 10,
  target_selection: 10,
  trade_selection: 12,
  confluence_selection: 40,
  annotation_filter: 40,
  annotation_coverage: 40,
};

/** Scores at or above these cut-offs read as correct / could improve. */
export const VERDICT_CUTOFFS = { correct: 80, couldImprove: 55 };

/** A near-miss never earns more than this share of an option's credit: it
 * decays linearly to nothing across the soft margin. */
export const NEAR_MISS_MAX_CREDIT = 0.6;

/** Default price tolerance for a reference mark that does not state one, as
 * a share of its price (0.06% is about 12 points on NQ at 20,000). */
export const DEFAULT_PRICE_TOLERANCE_RATIO = 0.0006;

/** A drawn zone must cover at least this share of a reference zone... */
export const ZONE_MIN_COVERAGE = 0.5;
/** ...and be no taller than this multiple of it (a box over everything is not a read). */
export const ZONE_MAX_HEIGHT_RATIO = 3.5;

/** Credit when the location is right but the label is not (an OB drawn as an
 * FVG, a plain zone on an FVG), and when a swing marker stands in for the
 * liquidity resting on it. */
export const LABEL_MISMATCH_CREDIT = 0.6;

/** How the mark comparison turns matches and false positives into credit. */
export const MARKS = {
  keyWeight: 1,
  groupWeight: 0.8,
  supportingBonus: 0.05,
  supportingBonusCap: 0.1,
  falsePositivePenalty: 0.12,
  trapPenalty: 0.18,
  irrelevantPenalty: 0.04,
  penaltyCap: 0.5,
};

/** Critical failures cap the process score no matter how good the rest was:
 * trading before confirmation, a stop that does not protect, trading where no
 * trade existed. One caps at `one`; two or more at `two`. */
export const CRITICAL_CAPS = { one: 70, two: 58 };

/** An entry fill this many candles before confirmation is "premature"; a
 * fill at or after confirmation is on time. */
export const CONFIRMATION = {
  /** Credit for a fill N candles early, indexed by N (0 = on time). */
  earlyCredit: (candlesEarly: number): number => (candlesEarly <= 0 ? 1 : candlesEarly <= 2 ? 0.35 : 0),
  /** A fill later than this many candles after the entry area is "late" (chasing). */
  lateAfterCandles: 90,
};

/** Stop scoring. */
export const STOP = {
  /** A stop that stops short of invalidation by this share of the distance or more is "partly protective". */
  partialShare: 0.7,
  partialCredit: 0.4,
  insideCredit: 0.1,
  /** Beyond the clean buffer, credit decays to this floor by this many buffers. */
  wideFloor: 0.6,
  wideBuffers: 4,
};

/** Dimension -> the mistake it implies when it fails outright. */
export const FAILURE_MISTAKE: Partial<Record<Dimension, MistakeId>> = {
  confirmation: "PREMATURE_ENTRY",
  stop_placement: "STOP_TOO_TIGHT",
  target_selection: "WRONG_DRAW",
};

/** Skills a dimension is evidence for, with weight (docs/ENGINE.md → Skills). */
export const DIMENSION_SKILLS: Record<Dimension, { skill: SkillId; weight: number }[]> = {
  htf_bias: [{ skill: "htf_bias", weight: 1 }],
  liquidity_read: [
    { skill: "liquidity", weight: 1 },
    { skill: "market_structure", weight: 0.3 },
  ],
  poi_selection: [
    { skill: "entry_models", weight: 0.7 },
    { skill: "concept_recognition", weight: 0.4 },
  ],
  entry_location: [{ skill: "entry_models", weight: 1 }],
  confirmation: [
    { skill: "confluence", weight: 0.8 },
    { skill: "market_structure", weight: 0.6 },
  ],
  stop_placement: [{ skill: "execution", weight: 1 }],
  target_selection: [
    { skill: "execution", weight: 0.7 },
    { skill: "liquidity", weight: 0.5 },
  ],
  trade_selection: [
    { skill: "execution", weight: 0.8 },
    { skill: "confluence", weight: 0.5 },
  ],
  confluence_selection: [{ skill: "confluence", weight: 1 }],
  annotation_filter: [
    { skill: "concept_recognition", weight: 1 },
    { skill: "confluence", weight: 0.4 },
  ],
  annotation_coverage: [
    { skill: "concept_recognition", weight: 1 },
    { skill: "market_structure", weight: 0.4 },
  ],
};
