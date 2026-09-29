// Guided Entry grading — deliberately separate from src/lib/grading.ts and
// from the UI. Guided Entry's shape doesn't fit the single UserAnswer /
// GradeResult pair the other concepts share: it's four dependent steps
// (bias, entry, stop, target) with a "No Trade" bailout available at any
// of them, so both the input and the result need their own types.
//
// Phase B (docs/APP_PERFECTION_PLAN.md) replaced all-or-nothing correctness
// with a three-state verdict per step (src/lib/verdict.ts) and an overall
// PROCESS_PASSED / PROCESS_PASSED_COULD_IMPROVE / PROCESS_FAILED verdict:
// entry and target are graded as zone membership (an entry at the far edge
// of a valid zone is correct, not wrong), stop is graded on whether it
// protects the trade against the level that invalidates it, and R:R gets
// its own near-miss band rather than a hard 2:1 cliff. One imperfect
// component never fails the whole attempt on its own.

import type { GuidedBias, GuidedExercise, PriceZoneAnswer, StopAnswer } from "@/data/exercises";
import {
  gradeProtectiveStop,
  gradeRiskReward,
  gradeZonePlacement,
  worstVerdict,
  type Verdict3,
} from "@/lib/verdict";

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
  verdict: Verdict3;
  explanation: string;
};

export type GuidedGradeResult = {
  verdict: Verdict3;
  /** Backward-compat: true for CORRECT and COULD_IMPROVE, false only for
   * INCORRECT (src/lib/verdict.ts). */
  isCorrect: boolean;
  /** Only for steps the user actually reached — bailing out at "entry"
   * means no "stop"/"target" result exists, not an incorrect one. */
  steps: GuidedStepResult[];
  /** Computed from the user's own placed levels, not the answer key's —
   * this is what the user actually built, shown against the required
   * minimum. Null whenever entry/stop/target aren't all present, or bias
   * is "unclear" (there's no direction to measure risk/reward against). */
  achievedRR: number | null;
  rrVerdict: Verdict3 | null;
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

function pts(n: number): string {
  const r = Math.round(Math.abs(n));
  return `${r} point${r === 1 ? "" : "s"}`;
}

/** A short, data-driven lead sentence naming what the user's own placement
 * actually did, ahead of the exercise's authored reasoning — never a
 * hard-coded generic string: every number in it comes from this attempt's
 * real price and the real answer key. */
function entryLead(verdict: Verdict3, price: number, zone: PriceZoneAnswer): string {
  if (verdict === "correct") return "Your entry sat inside the valid zone — anywhere in it counts.";
  const below = price < zone.price_low;
  const distance = below ? zone.price_low - price : price - zone.price_high;
  const where = below ? "below" : "above";
  return verdict === "could_improve"
    ? `Your entry was close, about ${pts(distance)} ${where} the zone.`
    : `Your entry was about ${pts(distance)} ${where} the zone — too far to call it anchored to this level.`;
}

function stopLead(verdict: Verdict3, price: number, stop: StopAnswer, direction: "long" | "short"): string {
  const protects = direction === "long" ? price <= stop.invalidation_price : price >= stop.invalidation_price;
  const distance = Math.abs(price - stop.invalidation_price);
  if (!protects) {
    return `Your stop was on the wrong side of the level that invalidates this idea, about ${pts(distance)} inside it — it wouldn't have protected the trade.`;
  }
  if (verdict === "correct") return "Your stop protects the trade without being unnecessarily wide.";
  const extra = distance - stop.reasonable_buffer;
  return `Your stop protects the trade, but it's about ${pts(extra)} wider than it needs to be — that cuts into your risk-to-reward for no added protection.`;
}

function targetLead(verdict: Verdict3, price: number, zone: PriceZoneAnswer): string {
  if (verdict === "correct") return "Good target — you aimed at the actual liquidity this setup was drawing toward.";
  const below = price < zone.price_low;
  const distance = below ? zone.price_low - price : price - zone.price_high;
  const where = below ? "short of" : "beyond";
  return verdict === "could_improve"
    ? `Your target was close, about ${pts(distance)} ${where} the liquidity area.`
    : `Your target wasn't aimed at the liquidity this setup was drawing toward — about ${pts(distance)} ${where} it.`;
}

const BIAS_LABEL: Record<GuidedBias, string> = { bullish: "bullish", bearish: "bearish", unclear: "unclear" };

export function gradeGuidedAttempt(
  exercise: GuidedExercise,
  answer: GuidedUserAnswer,
): GuidedGradeResult {
  const key = exercise.answer;
  const steps: GuidedStepResult[] = [];

  const biasCorrect = answer.bias === key.bias;
  steps.push({
    step: "bias",
    verdict: biasCorrect ? "correct" : "incorrect",
    explanation: biasCorrect
      ? key.step_explanations.bias
      : `You read this as ${BIAS_LABEL[answer.bias]}, but here's what actually happened: ${key.step_explanations.bias}`,
  });

  // Bullish/bearish keyed as "long"/"short" for the direction-aware stop
  // check below — bias is never "unclear" whenever key.stop is non-null.
  const direction: "long" | "short" | null = key.bias === "bullish" ? "long" : key.bias === "bearish" ? "short" : null;

  let entryVerdict: Verdict3 | null = null;
  if (answer.entry !== null) {
    entryVerdict = key.entry === null ? "incorrect" : gradeZonePlacement(answer.entry, key.entry);
    steps.push({
      step: "entry",
      verdict: entryVerdict,
      explanation: key.entry
        ? `${entryLead(entryVerdict, answer.entry, key.entry)} ${key.step_explanations.entry}`
        : `There was no valid entry level here. ${key.step_explanations.entry}`,
    });
  }

  let stopVerdict: Verdict3 | null = null;
  if (answer.stop !== null) {
    stopVerdict = key.stop === null || direction === null ? "incorrect" : gradeProtectiveStop(answer.stop, key.stop, direction);
    steps.push({
      step: "stop",
      verdict: stopVerdict,
      explanation:
        key.stop !== null && direction !== null
          ? `${stopLead(stopVerdict, answer.stop, key.stop, direction)} ${key.step_explanations.stop}`
          : `There was no level to build a stop from here. ${key.step_explanations.stop}`,
    });
  }

  let targetVerdict: Verdict3 | null = null;
  if (answer.target !== null) {
    targetVerdict = key.target === null ? "incorrect" : gradeZonePlacement(answer.target, key.target);
    steps.push({
      step: "target",
      verdict: targetVerdict,
      explanation: key.target
        ? `${targetLead(targetVerdict, answer.target, key.target)} ${key.step_explanations.target}`
        : `There was no liquidity worth targeting here. ${key.step_explanations.target}`,
    });
  }

  const achievedRR =
    answer.entry !== null && answer.stop !== null && answer.target !== null
      ? computeAchievedRR(answer.bias, answer.entry, answer.stop, answer.target)
      : null;
  const rrVerdict = answer.declaredTrade ? gradeRiskReward(achievedRR, key.min_rr) : null;

  let verdict: Verdict3;
  if (answer.declaredTrade) {
    // Confirmed as a valid trade. Trading a scenario with no valid setup at
    // all is a MAJOR error regardless of how the user's own levels read
    // (docs/CURRICULUM.md: "trading a no-trade scenario -> INCORRECT") —
    // there's no real level to have been anchored to either way. Otherwise
    // the worst of bias/entry/stop/target/R:R decides (one imperfect
    // component is COULD_IMPROVE, never a hard fail on its own).
    verdict = !key.is_valid_setup
      ? "incorrect"
      : worstVerdict([
          biasCorrect ? "correct" : "incorrect",
          entryVerdict ?? "incorrect",
          stopVerdict ?? "incorrect",
          targetVerdict ?? "incorrect",
          rrVerdict ?? "incorrect",
        ]);
  } else {
    // Bailed with "No Trade" at some step — a binary call, same as the
    // curriculum's "no trade is correct whenever ..." rule: right exactly
    // when this scenario really has no valid setup.
    verdict = key.is_valid_setup ? "incorrect" : "correct";
  }

  return {
    verdict,
    isCorrect: verdict !== "incorrect",
    steps,
    achievedRR,
    rrVerdict,
    minRR: key.min_rr,
    // Always states the correct read, right or wrong — the per-step results
    // and achieved-vs-minimum R:R (rendered alongside this) carry the
    // specific diagnostic of what the user did differently.
    explanation: key.overall_explanation,
  };
}
