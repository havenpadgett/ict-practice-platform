import type { Exercise } from "@/data/exercises";

/** The user's drawn box, already converted from pixels into price + candle-index domain. */
export type UserRegion = {
  priceLow: number;
  priceHigh: number;
  candleIndexLow: number;
  candleIndexHigh: number;
};

export type UserAnswer =
  | { type: "region"; region: UserRegion }
  | { type: "none" };

export type FailureReason =
  | "coverage"
  | "precision"
  | "time"
  | "missed_fvg"
  | "false_positive";

export type GradeResult = {
  isCorrect: boolean;
  coverage: number | null;
  precisionRatio: number | null;
  failureReason: FailureReason | null;
  /** One of the three PRD Section 6 sentences naming which test failed. */
  failureMessage: string | null;
  /** The exercise's explanation or distractor note — always shown as feedback. */
  explanation: string;
  /** Whether the feedback view should draw the true FVG zone on the chart. */
  revealZone: boolean;
};

const COVERAGE_THRESHOLD = 0.6;
const PRECISION_THRESHOLD = 2.5;

// Test 1 — Coverage (PRD Section 6): how much of the true gap's price range
// the user's box overlaps.
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
// than the true gap. 1.0 = exact size match; higher = drawn too wide.
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
// span the middle candle of the three-candle formation (candle_start + 1).
function includesMiddleCandle(
  candleIndexLow: number,
  candleIndexHigh: number,
  candleStart: number,
): boolean {
  const middleIndex = candleStart + 1;
  return candleIndexLow <= middleIndex && middleIndex <= candleIndexHigh;
}

export function gradeAttempt(
  exercise: Exercise,
  userAnswer: UserAnswer,
): GradeResult {
  const { has_fvg, answer } = exercise;

  if (!has_fvg) {
    // Grading matrix, bottom row: "No FVG present" is the correct answer
    // here; a drawn box is incorrect no matter where it lands.
    const isCorrect = userAnswer.type === "none";
    return {
      isCorrect,
      coverage: null,
      precisionRatio: null,
      failureReason: isCorrect ? null : "false_positive",
      failureMessage: null,
      explanation: exercise.distractor_note ?? exercise.explanation,
      revealZone: false,
    };
  }

  if (!answer) {
    throw new Error(`Exercise ${exercise.exercise_id} has has_fvg=true but no answer`);
  }

  if (userAnswer.type === "none") {
    // Grading matrix, top-right: the chart has a real FVG but the user
    // said there wasn't one.
    return {
      isCorrect: false,
      coverage: null,
      precisionRatio: null,
      failureReason: "missed_fvg",
      failureMessage: null,
      explanation: exercise.explanation,
      revealZone: true,
    };
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
  const timeOk = includesMiddleCandle(
    region.candleIndexLow,
    region.candleIndexHigh,
    answer.candle_start,
  );

  const coverageOk = coverage >= COVERAGE_THRESHOLD;
  const precisionOk = precisionRatio <= PRECISION_THRESHOLD;

  if (coverageOk && precisionOk && timeOk) {
    return {
      isCorrect: true,
      coverage,
      precisionRatio,
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
    failureReason = "coverage";
    failureMessage = "You marked the wrong area.";
  } else if (!precisionOk) {
    failureReason = "precision";
    failureMessage =
      "You found it, but your selection was too broad — an FVG is a specific price range.";
  } else {
    failureReason = "time";
    failureMessage = "Right price level, wrong candles.";
  }

  return {
    isCorrect: false,
    coverage,
    precisionRatio,
    failureReason,
    failureMessage,
    explanation: exercise.explanation,
    revealZone: true,
  };
}
