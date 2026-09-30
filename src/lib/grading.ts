import type { ChoiceExercise, Exercise, LevelExercise, ZoneExercise } from "@/data/exercises";
import { getConceptMeta } from "@/lib/concepts";
import { isCorrectForCompat, type Verdict3 } from "@/lib/verdict";

/** Everything gradeAttempt actually dispatches to below — Guided Entry is
 * graded separately (src/lib/guided-grading.ts) and never reaches these
 * functions, so they're typed against the three variants they handle
 * rather than the full Exercise union. */
type GradableExercise = ZoneExercise | LevelExercise | ChoiceExercise;

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
  | { type: "choice"; choice: string }
  | { type: "none" };

export type FailureReason =
  | "coverage"
  | "too_small"
  | "precision"
  | "time"
  | "off_level"
  | "wrong_choice"
  | "missed_answer"
  | "false_positive";

export type GradeResult = {
  /** Phase B (docs/APP_PERFECTION_PLAN.md): the three-state verdict.
   * COULD_IMPROVE is a near miss — right area/level, not quite precise —
   * distinct from a genuinely wrong read (INCORRECT). */
  verdict: Verdict3;
  /** Backward-compat: true for CORRECT and COULD_IMPROVE, false only for
   * INCORRECT (src/lib/verdict.ts). Every existing view/dashboard/analytics
   * computation keeps working unchanged against this field. */
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
  /** Mentor-style feedback: one or two self-contained sentences generated
   * from this exercise's own data (zoneExplanation/levelExplanation/
   * choiceExplanation below). Always shown, correct or not. */
  explanation: string;
  /** Whether the feedback view should draw the true answer on the chart. */
  revealZone: boolean;
  /** Each test the answer went through, measured, for the feedback's
   * checklist (buildChecks below). Null where there's nothing to measure
   * (choice answers). */
  checks: GradeCheck[] | null;
};

/** One line of the feedback checklist. `verdict: null` is a measurement
 * shown for information that isn't itself a pass/fail/near-miss test. */
export type GradeCheck = { id: string; label: string; verdict: Verdict3 | null; detail: string };

type GradeCore = Omit<GradeResult, "checks">;

const COVERAGE_THRESHOLD = 0.6;
const PRECISION_THRESHOLD = 2.5;
/** Beyond PRECISION_THRESHOLD but within this multiple is a box that's
 * clearly too broad but still roughly in the right place — COULD_IMPROVE
 * rather than a flatly wrong read. */
const PRECISION_INCORRECT_THRESHOLD = 5;
/** Beyond a level's tolerance but within this multiple of it is a near
 * miss (COULD_IMPROVE); further out is a genuinely wrong level. */
const LEVEL_INCORRECT_MULTIPLE = 2;
/** Floating-point safety margin for "is the user's box fully inside the
 * true zone" checks below. */
const CONTAINMENT_EPSILON = 0.01;

/** Rounds to a whole number for display — feedback text shouldn't stack
 * multiple decimal values into one sentence. Grading itself still uses the
 * exercise's full-precision stored values; only what's shown is rounded. */
export function formatPrice(value: number): string {
  return Math.round(value).toLocaleString("en-US");
}

// A blunt, coordinate-bearing statement of the correct answer — used by
// Review Mistakes (src/lib/mistake-text.ts), which shows it in its own
// "correct answer" field separately from the reasoning. The mentor-style
// GradeResult.explanation below (zoneExplanation/levelExplanation/
// choiceExplanation) states coordinates itself where they matter (a missed
// or off-level answer) rather than composing with this statement.
export function buildCorrectAnswerStatement(exercise: GradableExercise): string {
  // Choice exercises (FVG respected/disrespected) always have a definite
  // correct option among the choices offered — there's no "no X on this
  // chart" case the way zone/level exercises have, so this branches before
  // the has_answer check below, which doesn't apply to this type.
  if (exercise.answer_type === "choice") {
    const correctOption = exercise.options.find((o) => o.value === exercise.answer.correct_choice);
    return `The correct answer was: ${correctOption?.label ?? exercise.answer.correct_choice}.`;
  }
  if (!exercise.has_answer) {
    return `The correct answer was: no ${exercise.answerLabel} on this chart.`;
  }
  if (exercise.answer_type === "zone") {
    const answer = exercise.answer;
    if (!answer) {
      throw new Error(`Exercise ${exercise.exercise_id} has has_answer=true but no answer`);
    }
    return `The correct answer was: a ${exercise.answerLabel} between ${formatPrice(answer.price_low)} and ${formatPrice(answer.price_high)}.`;
  }
  const answer = exercise.answer;
  if (!answer) {
    throw new Error(`Exercise ${exercise.exercise_id} has has_answer=true but no answer`);
  }
  return `The correct answer was: a ${exercise.answerLabel} level around ${formatPrice(answer.price)}.`;
}

// Mentor-style feedback (docs/APP_PERFECTION_PLAN.md, Phase C — extended
// from Guided Entry/Free Trade to recognition exercises): a short,
// self-contained line or two, generated from this exercise's own data
// (its authored explanation/distractor_note, and — for near-miss reads —
// the concept's plain-English rule from src/lib/concepts.ts) rather than
// a hard-coded generic phrase. Correct answers confirm what the user read
// right, not just that they were right; near-misses say what to look for
// instead, in the concept's own terms.

/** The concept's rule in plain words (src/lib/concepts.ts) — used as the
 * "what to look for instead" clause for a near-miss read that's in the
 * right place but not quite matching the concept's actual definition
 * (e.g. a box drawn too wide). Data-driven per concept, not per exercise,
 * same as KEY_CANDLE below. */
function conceptRule(exercise: GradableExercise): string {
  return getConceptMeta(exercise.concept).rule ?? exercise.explanation;
}

function zoneExplanation(exercise: ZoneExercise, userAnswer: UserAnswer, verdict: Verdict3, failureReason: FailureReason | null): string {
  const { has_answer, answer, answerLabel } = exercise;

  if (!has_answer) {
    const reasoning = exercise.distractor_note ?? exercise.explanation;
    return verdict === "correct" ? `Right — there's no ${answerLabel} here. ${reasoning}` : `There's no ${answerLabel} here. ${reasoning}`;
  }
  if (!answer) throw new Error(`Exercise ${exercise.exercise_id} has has_answer=true but no answer`);

  if (userAnswer.type === "none") {
    return `There was a real ${answerLabel} here, between ${formatPrice(answer.price_low)} and ${formatPrice(answer.price_high)}. ${exercise.explanation}`;
  }
  if (verdict === "correct") return `Right — ${exercise.explanation}`;
  if (failureReason === "too_small") return conceptRule(exercise);
  if (failureReason === "precision") return conceptRule(exercise);
  // "coverage" (wrong area) and "time" (wrong candles) both mean the box
  // isn't anchored to the real zone — the real zone's own reasoning is the
  // most useful "look for this instead" for either.
  return exercise.explanation;
}

function levelExplanation(exercise: LevelExercise, userAnswer: UserAnswer, verdict: Verdict3): string {
  const { has_answer, answer, answerLabel } = exercise;

  if (!has_answer) {
    const reasoning = exercise.distractor_note ?? exercise.explanation;
    return verdict === "correct" ? `Right — there's no ${answerLabel} here. ${reasoning}` : `There's no ${answerLabel} here. ${reasoning}`;
  }
  if (!answer) throw new Error(`Exercise ${exercise.exercise_id} has has_answer=true but no answer`);

  if (userAnswer.type === "none") {
    return `There was a real ${answerLabel} here, around ${formatPrice(answer.price)}. ${exercise.explanation}`;
  }
  if (verdict === "correct") return `Right — ${exercise.explanation}`;
  return exercise.explanation;
}

function choiceExplanation(exercise: ChoiceExercise, verdict: Verdict3): string {
  if (verdict === "correct") return `Right — ${exercise.explanation}`;
  const correctOption = exercise.options.find((o) => o.value === exercise.answer.correct_choice);
  const correctLabel = correctOption?.label ?? exercise.answer.correct_choice;
  return `${exercise.explanation} The read here is "${correctLabel}."`;
}

export function gradeAttempt(exercise: Exercise, userAnswer: UserAnswer): GradeResult {
  if (exercise.answer_type === "zone") {
    const core = gradeZoneAttempt(exercise, userAnswer);
    return { ...core, checks: buildChecks(exercise, userAnswer, core) };
  }
  if (exercise.answer_type === "level") {
    const core = gradeLevelAttempt(exercise, userAnswer);
    return { ...core, checks: buildChecks(exercise, userAnswer, core) };
  }
  if (exercise.answer_type === "choice") {
    return { ...gradeChoiceAttempt(exercise, userAnswer), checks: null };
  }
  // Guided Entry's multi-step flow doesn't reduce to a single UserAnswer/
  // GradeResult — it's graded by gradeGuidedAttempt (src/lib/guided-grading.ts)
  // instead, called directly from the Guided Entry runner component, never
  // through this dispatcher.
  throw new Error(
    `gradeAttempt does not support guided exercises (${exercise.exercise_id}) — use gradeGuidedAttempt from src/lib/guided-grading.ts instead.`,
  );
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

function gradeZoneAttempt(exercise: ZoneExercise, userAnswer: UserAnswer): GradeCore {
  const { has_answer, answer } = exercise;

  if (!has_answer) {
    // Grading matrix, bottom row: "No zone present" is the correct answer
    // here; a drawn box is a genuinely wrong read no matter where it lands
    // — there's no near-miss version of claiming a zone that isn't there.
    const correct = userAnswer.type === "none";
    return {
      verdict: correct ? "correct" : "incorrect",
      isCorrect: correct,
      coverage: null,
      precisionRatio: null,
      distanceFromLevel: null,
      failureReason: correct ? null : "false_positive",
      failureMessage: null,
      explanation: zoneExplanation(exercise, userAnswer, correct ? "correct" : "incorrect", correct ? null : "false_positive"),
      revealZone: false,
    };
  }

  if (!answer) {
    throw new Error(`Exercise ${exercise.exercise_id} has has_answer=true but no answer`);
  }

  if (userAnswer.type === "none") {
    // Grading matrix, top-right: the chart has a real zone but the user
    // said there wasn't one — missing it entirely, not a near miss.
    return {
      verdict: "incorrect",
      isCorrect: false,
      coverage: null,
      precisionRatio: null,
      distanceFromLevel: null,
      failureReason: "missed_answer",
      failureMessage: null,
      explanation: zoneExplanation(exercise, userAnswer, "incorrect", "missed_answer"),
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
      verdict: "correct",
      isCorrect: true,
      coverage,
      precisionRatio,
      distanceFromLevel: null,
      failureReason: null,
      failureMessage: null,
      explanation: zoneExplanation(exercise, userAnswer, "correct", null),
      revealZone: true,
    };
  }

  // Checked in the priority order the PRD specifies — coverage, then
  // precision, then time — so a box failing more than one test is
  // explained by the earliest one. A box that's in the right area but not
  // quite precise (too small but fully inside the zone, or too broad but
  // within PRECISION_INCORRECT_THRESHOLD) is COULD_IMPROVE, not flatly
  // wrong — same MINOR/MAJOR distinction as docs/CURRICULUM.md's Phase B
  // severity rule, applied to Recognition's coverage/precision/time tests.
  let verdict: Verdict3;
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
      verdict = "could_improve";
      failureReason = "too_small";
      failureMessage = "Right area, but your selection was too small to cover enough of the zone.";
    } else {
      verdict = "incorrect";
      failureReason = "coverage";
      failureMessage = "You marked the wrong area.";
    }
  } else if (!precisionOk) {
    verdict = precisionRatio <= PRECISION_INCORRECT_THRESHOLD ? "could_improve" : "incorrect";
    failureReason = "precision";
    failureMessage = "You found the right area, but marked it too wide.";
  } else {
    verdict = "incorrect";
    failureReason = "time";
    failureMessage = "Right price level, wrong candles.";
  }

  return {
    verdict,
    isCorrect: isCorrectForCompat(verdict),
    coverage,
    precisionRatio,
    distanceFromLevel: null,
    failureReason,
    failureMessage,
    explanation: zoneExplanation(exercise, userAnswer, verdict, failureReason),
    revealZone: true,
  };
}

// ---- Level grading (Liquidity) --------------------------------------------
// A liquidity level is a price, not a zone — there's nothing to measure
// coverage or precision against, and no time-window test (a resting level
// isn't tied to a fixed number of candles the way an FVG is). Correctness
// is a single check: is the placed line within tolerance of the true price?

function gradeLevelAttempt(exercise: LevelExercise, userAnswer: UserAnswer): GradeCore {
  const { has_answer, answer, answerLabel } = exercise;

  if (!has_answer) {
    const correct = userAnswer.type === "none";
    return {
      verdict: correct ? "correct" : "incorrect",
      isCorrect: correct,
      coverage: null,
      precisionRatio: null,
      distanceFromLevel: null,
      failureReason: correct ? null : "false_positive",
      failureMessage: null,
      explanation: levelExplanation(exercise, userAnswer, correct ? "correct" : "incorrect"),
      revealZone: false,
    };
  }

  if (!answer) {
    throw new Error(`Exercise ${exercise.exercise_id} has has_answer=true but no answer`);
  }

  if (userAnswer.type === "none") {
    return {
      verdict: "incorrect",
      isCorrect: false,
      coverage: null,
      precisionRatio: null,
      distanceFromLevel: null,
      failureReason: "missed_answer",
      failureMessage: null,
      explanation: levelExplanation(exercise, userAnswer, "incorrect"),
      revealZone: true,
    };
  }

  if (userAnswer.type !== "level") {
    throw new Error(`Level exercise ${exercise.exercise_id} received a non-level answer`);
  }

  // Positive = the user placed the line above the true level; negative = below.
  const distanceFromLevel = userAnswer.price - answer.price;
  const abs = Math.abs(distanceFromLevel);
  // Within tolerance: correct. Within LEVEL_INCORRECT_MULTIPLE x tolerance:
  // a near miss (COULD_IMPROVE) — right area, not quite precise. Further:
  // a genuinely wrong level.
  const verdict: Verdict3 = abs <= answer.tolerance ? "correct" : abs <= answer.tolerance * LEVEL_INCORRECT_MULTIPLE ? "could_improve" : "incorrect";

  if (verdict === "correct") {
    return {
      verdict,
      isCorrect: true,
      coverage: null,
      precisionRatio: null,
      distanceFromLevel,
      failureReason: null,
      failureMessage: null,
      explanation: levelExplanation(exercise, userAnswer, "correct"),
      revealZone: true,
    };
  }

  // Names the direction and rough distance in terms of what the level
  // actually represents (its own answerLabel, e.g. "Buy-Side Liquidity" or
  // "Previous Day High") rather than a bare number — the exercise's own
  // explanation, shown alongside, then says what that level represents.
  const direction = distanceFromLevel > 0 ? "high" : "low";
  const failureMessage = `You were ${Math.round(abs)} points too ${direction} of the actual ${answerLabel.toLowerCase()}, at ${formatPrice(answer.price)}.`;

  return {
    verdict,
    isCorrect: isCorrectForCompat(verdict),
    coverage: null,
    precisionRatio: null,
    distanceFromLevel,
    failureReason: "off_level",
    failureMessage,
    explanation: levelExplanation(exercise, userAnswer, verdict),
    revealZone: true,
  };
}

// ---- Choice grading (FVG respected vs. disrespected) ----------------------
// The user picks one of a fixed set of options instead of drawing — there's
// nothing to measure coverage, precision, or distance against. Correctness
// is a single equality check against the exercise's correct_choice.

function gradeChoiceAttempt(exercise: ChoiceExercise, userAnswer: UserAnswer): GradeCore {
  if (userAnswer.type !== "choice") {
    throw new Error(`Choice exercise ${exercise.exercise_id} received a non-choice answer`);
  }

  const isCorrect = userAnswer.choice === exercise.answer.correct_choice;

  return {
    // Choice is a discrete pick among a fixed set of options — no near-miss
    // state applies, unlike the continuous zone/level answers above.
    verdict: isCorrect ? "correct" : "incorrect",
    isCorrect,
    coverage: null,
    precisionRatio: null,
    distanceFromLevel: null,
    failureReason: isCorrect ? null : "wrong_choice",
    failureMessage: null,
    explanation: choiceExplanation(exercise, isCorrect ? "correct" : "incorrect"),
    // Always reveal the FVG zone — it's shown on the chart from the start
    // for this exercise type (see ChoiceAnswer's fvg_zone comment in
    // exercises.ts), so this just keeps that overlay in place through
    // feedback rather than toggling it.
    revealZone: true,
  };
}

// ---- Feedback checklist ------------------------------------------------------
// The same tests as above, reported one by one with the measured value, so
// feedback says *how* an answer was off ("Coverage ✓ · Candles ✓ · Size ✗,
// box 3.1× the zone's height") rather than only which test failed first.
// Pure reporting: it never changes the verdict, which gradeZoneAttempt /
// gradeLevelAttempt decide.

/** What the key candle is, per zone concept, for the Candles check. */
const KEY_CANDLE: Record<string, string> = {
  FVG: "the middle candle of the three-candle gap",
  IFVG: "the middle candle of the original gap",
  OrderBlock: "the order block candle",
};

function signedPoints(x: number): string {
  const r = Math.round(x);
  return r === 0 ? "level with" : `${Math.abs(r)} point${Math.abs(r) === 1 ? "" : "s"} ${r > 0 ? "above" : "below"}`;
}

export function buildChecks(exercise: ZoneExercise | LevelExercise, userAnswer: UserAnswer, result: GradeCore): GradeCheck[] | null {
  // Nothing measured when the question was "is there one at all": the
  // explanation already opens (or closes) with the plain answer.
  if (!exercise.has_answer || userAnswer.type === "none") return null;

  if (exercise.answer_type === "zone" && userAnswer.type === "region" && exercise.answer) {
    const a = exercise.answer;
    const r = userAnswer.region;
    const coverage = result.coverage ?? 0;
    const ratio = result.precisionRatio ?? 0;
    const timeOk = includesKeyCandle(r.candleIndexLow, r.candleIndexHigh, a.key_candle_index);
    const key = KEY_CANDLE[exercise.concept] ?? "the setup's key candle";
    const coverageVerdict: Verdict3 =
      coverage >= COVERAGE_THRESHOLD ? "correct" : result.failureReason === "too_small" ? "could_improve" : "incorrect";
    const sizeVerdict: Verdict3 = ratio <= PRECISION_THRESHOLD ? "correct" : ratio <= PRECISION_INCORRECT_THRESHOLD ? "could_improve" : "incorrect";
    return [
      {
        id: "coverage",
        label: "Coverage",
        verdict: coverageVerdict,
        detail:
          `Your box covers ${Math.round(coverage * 100)}% of the zone's price range (${Math.round(COVERAGE_THRESHOLD * 100)}% needed).` +
          (result.failureReason === "too_small" ? " It sits inside the zone, so draw it taller." : ""),
      },
      {
        id: "size",
        label: "Size",
        verdict: sizeVerdict,
        detail: `Your box is ${ratio.toFixed(1)}× the zone's height (up to ${PRECISION_THRESHOLD}× passes).`,
      },
      {
        id: "candles",
        label: "Candles",
        verdict: timeOk ? "correct" : "incorrect",
        detail: timeOk ? `Your box spans ${key}.` : `Your box doesn't span ${key}. It's highlighted on the chart.`,
      },
      {
        id: "edges",
        label: "Edges",
        verdict: null,
        detail: `Your top edge is ${signedPoints(r.priceHigh - a.price_high)} the zone's top; your bottom edge is ${signedPoints(r.priceLow - a.price_low)} its bottom.`,
      },
    ];
  }

  if (exercise.answer_type === "level" && userAnswer.type === "level" && exercise.answer) {
    const d = userAnswer.price - exercise.answer.price;
    const tol = exercise.answer.tolerance;
    const abs = Math.round(Math.abs(d));
    const within = Math.abs(d) <= tol;
    const nearMiss = Math.abs(d) <= tol * LEVEL_INCORRECT_MULTIPLE;
    const dir = d > 0 ? "high" : "low";
    return [
      {
        id: "placement",
        label: "Placement",
        verdict: within ? "correct" : nearMiss ? "could_improve" : "incorrect",
        detail: within
          ? `Your line is ${abs} point${abs === 1 ? "" : "s"} from the level, inside the ±${tol} tolerance.`
          : nearMiss
            ? `Right area, but ${abs} points too ${dir}: just outside the ±${tol} tolerance.`
            : `Your line is ${abs} points too ${dir}. It needs to be within ±${tol} points of the level.`,
      },
    ];
  }
  return null;
}
