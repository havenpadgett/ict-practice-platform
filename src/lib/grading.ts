import type { Exercise, LevelExercise, ZoneExercise } from "@/data/exercises";
import { CONCEPTS } from "@/lib/concepts";

/** The user's drawn box, already converted from pixels into price + candle-index domain. */
export type UserRegion = {
  priceLow: number;
  priceHigh: number;
  candleIndexLow: number;
  candleIndexHigh: number;
};

export type UserAnswer =
  | { type: "region"; region: UserRegion }
  | { type: "level"; price: number }
  | { type: "none" };

export type FailureReason =
  | "coverage"
  | "too_small"
  | "precision"
  | "time"
  | "off_level"
  | "missed_answer"
  | "false_positive";

export type GradeResult = {
  isCorrect: boolean;
  /** Zone-only; null for level exercises. */
  coverage: number | null;
  /** Zone-only; null for level exercises. */
  precisionRatio: number | null;
  /** Level-only; null for zone exercises. Signed: positive = placed above
   * the true level, negative = below. */
  distanceFromLevel: number | null;
  failureReason: FailureReason | null;
  /** Names which test failed, or how far off a level answer was. */
  failureMessage: string | null;
  /** The exercise's explanation or distractor note — always shown as feedback. */
  explanation: string;
  /** Whether the feedback view should draw the true answer on the chart. */
  revealZone: boolean;
};

const COVERAGE_THRESHOLD = 0.6;
const PRECISION_THRESHOLD = 2.5;
/** Floating-point safety margin for "is the user's box fully inside the
 * true zone" checks below. */
const CONTAINMENT_EPSILON = 0.01;

export function gradeAttempt(exercise: Exercise, userAnswer: UserAnswer): GradeResult {
  if (exercise.answer_type === "zone") {
    return gradeZoneAttempt(exercise, userAnswer);
  }
  return gradeLevelAttempt(exercise, userAnswer);
}

// ---- Zone grading (FVG) ---------------------------------------------------
// A "zone" is a price range across a candle range. Coverage/precision/time
// window measure how well the user's drawn box matches that range.

// Test 1 — Coverage (PRD Section 6): how much of the true zone's price
// range the user's box overlaps.
//   overlap  = min(user_high, true_high) - max(user_low, true_low)
//   coverage = overlap / (true_high - true_low)
// Clamped to 0 so a box that misses the zone entirely (negative overlap)
// doesn't produce a negative coverage value.
function computeCoverage(
  userLow: number,
  userHigh: number,
  trueLow: number,
  trueHigh: number,
): number {
  const overlap = Math.min(userHigh, trueHigh) - Math.max(userLow, trueLow);
  const trueRange = trueHigh - trueLow;
  return Math.max(0, overlap) / trueRange;
}

// Test 2 — Precision (PRD Section 6): how much larger the user's box is
// than the true zone. 1.0 = exact size match; higher = drawn too wide.
//   precision_ratio = (user_high - user_low) / (true_high - true_low)
function computePrecisionRatio(
  userLow: number,
  userHigh: number,
  trueLow: number,
  trueHigh: number,
): number {
  const trueRange = trueHigh - trueLow;
  return (userHigh - userLow) / trueRange;
}

// Test 3 — Time window (PRD Section 6): the user's box must horizontally
// span the zone's key candle (the middle candle of FVG's three-candle
// formation).
function includesKeyCandle(
  candleIndexLow: number,
  candleIndexHigh: number,
  keyCandleIndex: number,
): boolean {
  return candleIndexLow <= keyCandleIndex && keyCandleIndex <= candleIndexHigh;
}

function gradeZoneAttempt(exercise: ZoneExercise, userAnswer: UserAnswer): GradeResult {
  const { has_answer, answer } = exercise;
  const zoneNoun = CONCEPTS[exercise.concept].zoneNoun;

  if (!has_answer) {
    // Grading matrix, bottom row: "No zone present" is the correct answer
    // here; a drawn box is incorrect no matter where it lands.
    const isCorrect = userAnswer.type === "none";
    return {
      isCorrect,
      coverage: null,
      precisionRatio: null,
      distanceFromLevel: null,
      failureReason: isCorrect ? null : "false_positive",
      failureMessage: null,
      explanation: exercise.distractor_note ?? exercise.explanation,
      revealZone: false,
    };
  }

  if (!answer) {
    throw new Error(`Exercise ${exercise.exercise_id} has has_answer=true but no answer`);
  }

  if (userAnswer.type === "none") {
    // Grading matrix, top-right: the chart has a real zone but the user
    // said there wasn't one.
    return {
      isCorrect: false,
      coverage: null,
      precisionRatio: null,
      distanceFromLevel: null,
      failureReason: "missed_answer",
      failureMessage: null,
      explanation: exercise.explanation,
      revealZone: true,
    };
  }

  if (userAnswer.type !== "region") {
    throw new Error(`Zone exercise ${exercise.exercise_id} received a non-region answer`);
  }

  const { region } = userAnswer;
  const coverage = computeCoverage(
    region.priceLow,
    region.priceHigh,
    answer.price_low,
    answer.price_high,
  );
  const precisionRatio = computePrecisionRatio(
    region.priceLow,
    region.priceHigh,
    answer.price_low,
    answer.price_high,
  );
  const timeOk = includesKeyCandle(
    region.candleIndexLow,
    region.candleIndexHigh,
    answer.key_candle_index,
  );

  const coverageOk = coverage >= COVERAGE_THRESHOLD;
  const precisionOk = precisionRatio <= PRECISION_THRESHOLD;

  if (coverageOk && precisionOk && timeOk) {
    return {
      isCorrect: true,
      coverage,
      precisionRatio,
      distanceFromLevel: null,
      failureReason: null,
      failureMessage: null,
      explanation: exercise.explanation,
      revealZone: true,
    };
  }

  // Checked in the priority order the PRD specifies — coverage, then
  // precision, then time — so a box failing more than one test is
  // explained by the earliest one.
  let failureReason: FailureReason;
  let failureMessage: string;
  if (!coverageOk) {
    // A box entirely inside the true zone (never sticking out past either
    // edge) was placed correctly — coverage only failed because it was
    // drawn too small, not because it missed. That's a different mistake
    // from actually marking the wrong area, and deserves a different
    // message (bug found during Liquidity's level-based redesign: a
    // correctly-placed but thin box was told "you marked the wrong area",
    // which was inaccurate).
    const isFullyContained =
      region.priceLow >= answer.price_low - CONTAINMENT_EPSILON &&
      region.priceHigh <= answer.price_high + CONTAINMENT_EPSILON;
    if (isFullyContained) {
      failureReason = "too_small";
      failureMessage = "Right area, but your selection was too small to cover enough of the zone.";
    } else {
      failureReason = "coverage";
      failureMessage = "You marked the wrong area.";
    }
  } else if (!precisionOk) {
    failureReason = "precision";
    failureMessage = `You found it, but your selection was too broad — ${zoneNoun} is a specific price range.`;
  } else {
    failureReason = "time";
    failureMessage = "Right price level, wrong candles.";
  }

  return {
    isCorrect: false,
    coverage,
    precisionRatio,
    distanceFromLevel: null,
    failureReason,
    failureMessage,
    explanation: exercise.explanation,
    revealZone: true,
  };
}

// ---- Level grading (Liquidity) --------------------------------------------
// A liquidity level is a price, not a zone — there's nothing to measure
// coverage or precision against, and no time-window test (a resting level
// isn't tied to a fixed number of candles the way an FVG is). Correctness
// is a single check: is the placed line within tolerance of the true price?

function gradeLevelAttempt(exercise: LevelExercise, userAnswer: UserAnswer): GradeResult {
  const { has_answer, answer } = exercise;

  if (!has_answer) {
    const isCorrect = userAnswer.type === "none";
    return {
      isCorrect,
      coverage: null,
      precisionRatio: null,
      distanceFromLevel: null,
      failureReason: isCorrect ? null : "false_positive",
      failureMessage: null,
      explanation: exercise.distractor_note ?? exercise.explanation,
      revealZone: false,
    };
  }

  if (!answer) {
    throw new Error(`Exercise ${exercise.exercise_id} has has_answer=true but no answer`);
  }

  if (userAnswer.type === "none") {
    return {
      isCorrect: false,
      coverage: null,
      precisionRatio: null,
      distanceFromLevel: null,
      failureReason: "missed_answer",
      failureMessage: null,
      explanation: exercise.explanation,
      revealZone: true,
    };
  }

  if (userAnswer.type !== "level") {
    throw new Error(`Level exercise ${exercise.exercise_id} received a non-level answer`);
  }

  // Positive = the user placed the line above the true level; negative = below.
  const distanceFromLevel = userAnswer.price - answer.price;
  const isCorrect = Math.abs(distanceFromLevel) <= answer.tolerance;

  if (isCorrect) {
    return {
      isCorrect: true,
      coverage: null,
      precisionRatio: null,
      distanceFromLevel,
      failureReason: null,
      failureMessage: null,
      explanation: exercise.explanation,
      revealZone: true,
    };
  }

  const direction = distanceFromLevel > 0 ? "high" : "low";
  const failureMessage = `You were ${Math.abs(distanceFromLevel).toFixed(2)} points too ${direction}.`;

  return {
    isCorrect: false,
    coverage: null,
    precisionRatio: null,
    distanceFromLevel,
    failureReason: "off_level",
    failureMessage,
    explanation: exercise.explanation,
    revealZone: true,
  };
}
