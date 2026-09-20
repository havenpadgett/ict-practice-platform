// Guided Entry grading — deliberately separate from src/lib/grading.ts and
// from the UI. Guided Entry's shape doesn't fit the single UserAnswer /
// GradeResult pair the other concepts share: it's four dependent steps
// (bias, entry, stop, target) with a "No Trade" bailout available at any
// of them, so both the input and the result need their own types.

import type { GuidedBias, GuidedExercise, GuidedLevelAnswer } from "@/data/exercises";

export type GuidedStepId = "bias" | "entry" | "stop" | "target";

export type GuidedUserAnswer = {
  bias: GuidedBias;
  /** Null if the user hadn't reached/placed this step before finishing
   * (either via "No Trade" or because bias was "unclear", which has
   * nowhere to build entry/stop/target against). */
  entry: number | null;
  stop: number | null;
  target: number | null;
  /** True only if the user placed all three levels and pressed "Submit
   * Setup" rather than "No Trade" at any point. */
  declaredTrade: boolean;
};

export type GuidedStepResult = {
  step: GuidedStepId;
  isCorrect: boolean;
  explanation: string;
};

export type GuidedGradeResult = {
  isCorrect: boolean;
  /** Only for steps the user actually reached — bailing out at "entry"
   * means no "stop"/"target" result exists, not an incorrect one. */
  steps: GuidedStepResult[];
  /** Computed from the user's own placed levels, not the answer key's —
   * this is what the user actually built, shown against the required
   * minimum. Null whenever entry/stop/target aren't all present, or bias
   * is "unclear" (there's no direction to measure risk/reward against). */
  achievedRR: number | null;
  minRR: number;
  /** Overall verdict text, shown once. */
  explanation: string;
};

/** Risk-to-reward for a user-built setup, per docs/CURRICULUM.md's Guided
 * Entry formula (mirrored for a short). Null if bias is "unclear" (no
 * direction to measure against) or if risk is zero/negative (a stop placed
 * on the wrong side of entry isn't a real risk figure). */
export function computeAchievedRR(
  bias: GuidedBias,
  entry: number,
  stop: number,
  target: number,
): number | null {
  if (bias === "unclear") return null;
  const risk = bias === "bullish" ? entry - stop : stop - entry;
  const reward = bias === "bullish" ? target - entry : entry - target;
  if (risk <= 0) return null;
  return reward / risk;
}

function withinTolerance(userPrice: number, key: GuidedLevelAnswer): boolean {
  return Math.abs(userPrice - key.price) <= key.tolerance;
}

export function gradeGuidedAttempt(
  exercise: GuidedExercise,
  answer: GuidedUserAnswer,
): GuidedGradeResult {
  const key = exercise.answer;
  const steps: GuidedStepResult[] = [];

  const biasCorrect = answer.bias === key.bias;
  steps.push({ step: "bias", isCorrect: biasCorrect, explanation: key.step_explanations.bias });

  if (answer.entry !== null) {
    const entryCorrect = key.entry !== null && withinTolerance(answer.entry, key.entry);
    steps.push({ step: "entry", isCorrect: entryCorrect, explanation: key.step_explanations.entry });
  }
  if (answer.stop !== null) {
    const stopCorrect = key.stop !== null && withinTolerance(answer.stop, key.stop);
    steps.push({ step: "stop", isCorrect: stopCorrect, explanation: key.step_explanations.stop });
  }
  if (answer.target !== null) {
    const targetCorrect = key.target !== null && withinTolerance(answer.target, key.target);
    steps.push({ step: "target", isCorrect: targetCorrect, explanation: key.step_explanations.target });
  }

  const achievedRR =
    answer.entry !== null && answer.stop !== null && answer.target !== null
      ? computeAchievedRR(answer.bias, answer.entry, answer.stop, answer.target)
      : null;

  let isCorrect: boolean;
  if (answer.declaredTrade) {
    // Confirmed as a valid trade — every step must actually be right, and
    // the setup the user built (not the answer key's) must clear min_rr.
    const levelsCorrect = steps
      .filter((s): s is GuidedStepResult & { step: "entry" | "stop" | "target" } => s.step !== "bias")
      .every((s) => s.isCorrect);
    isCorrect =
      key.is_valid_setup &&
      biasCorrect &&
      levelsCorrect &&
      achievedRR !== null &&
      achievedRR >= key.min_rr;
  } else {
    // Bailed with "No Trade" at some step — correct exactly when this
    // scenario really has no valid setup (PRD: unclear bias, no valid
    // entry, or best R:R below minimum all mean "No Trade" is right).
    isCorrect = !key.is_valid_setup;
  }

  return {
    isCorrect,
    steps,
    achievedRR,
    minRR: key.min_rr,
    // Always states the correct read, right or wrong — the per-step results
    // and achieved-vs-minimum R:R (rendered alongside this) carry the
    // specific diagnostic of what the user did differently.
    explanation: key.overall_explanation,
  };
}
