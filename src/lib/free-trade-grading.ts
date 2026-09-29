// Free Trade grading — separate from src/lib/grading.ts and guided-grading.ts
// for the same reason Guided Entry is: the input is a whole trade (or the
// decision not to take one), played out against hidden candles, not a single
// drawn answer. Everything here is pure so the playback runner can call it
// from a reducer.
//
// The overall verdict is process-based (docs/CURRICULUM.md, Free Trade): a
// losing trade with good process passes, a winning trade with bad process
// fails. Outcome (win/loss, result in R) is reported alongside, never mixed
// into the verdict.
//
// Phase B (docs/APP_PERFECTION_PLAN.md) widened every check from pass/fail
// to the three-state verdict (src/lib/verdict.ts) and closed the "target
// isn't graded on its own" V1 gap: target is now its own check, graded as
// zone membership, same reasoning as entry.

import type { Candle, FreeTradeDirection, FreeTradeExercise, FreeTradePriceZone, FreeTradeTargetZone, StopAnswer } from "@/data/exercises";
import {
  gradeProtectiveStop,
  gradeRiskReward,
  gradeZonePlacement,
  worstVerdict,
  type Verdict3,
} from "@/lib/verdict";

export type FreeTradePosition = {
  direction: FreeTradeDirection;
  /** Index (into candles followed by hidden_candles) of the candle whose
   * close filled the entry. */
  entryIndex: number;
  entry: number;
  stop: number;
  target: number;
};

export type FreeTradeExitReason = "stop" | "target" | "session_end";

export type FreeTradeExit = {
  index: number;
  price: number;
  reason: FreeTradeExitReason;
};

/** "open" = neither stop nor target was hit before the scenario ended; the
 * trade is marked at the last revealed close. */
export type FreeTradeOutcome = "win" | "loss" | "open" | "no_trade";

export type FreeTradeCheckId = "direction" | "entry" | "stop" | "target" | "rr" | "decision";

export type FreeTradeCheck = {
  id: FreeTradeCheckId;
  label: string;
  /** null when the check doesn't apply (e.g. entry/stop/target/rr when no
   * trade was taken) — recorded as null, not "incorrect". */
  verdict: Verdict3 | null;
  reason: string;
};

export type FreeTradeGradeResult = {
  verdict: Verdict3;
  /** Backward-compat: true for CORRECT and COULD_IMPROVE, false only for
   * INCORRECT (src/lib/verdict.ts). */
  passed: boolean;
  outcome: FreeTradeOutcome;
  /** Null when no trade was taken. */
  resultR: number | null;
  /** The user's own planned R:R; null when no trade was taken. */
  rr: number | null;
  minRR: number;
  checks: FreeTradeCheck[];
  explanation: string;
};

const CHECK_LABELS: Record<FreeTradeCheckId, string> = {
  direction: "Direction",
  entry: "Entry",
  stop: "Stop",
  target: "Target",
  rr: "Risk-to-reward",
  decision: "Trade decision",
};

/** Planned risk-to-reward, per docs/CURRICULUM.md's formula (mirrored for a
 * short). Null if the stop isn't on the losing side of entry — that's not a
 * real risk figure. */
export function computeRR(
  direction: FreeTradeDirection,
  entry: number,
  stop: number,
  target: number,
): number | null {
  const risk = direction === "long" ? entry - stop : stop - entry;
  const reward = direction === "long" ? target - entry : entry - target;
  if (risk <= 0) return null;
  return reward / risk;
}

export function isStopOnLosingSide(direction: FreeTradeDirection, entry: number, stop: number): boolean {
  return direction === "long" ? stop < entry : stop > entry;
}

export function isTargetOnWinningSide(direction: FreeTradeDirection, entry: number, target: number): boolean {
  return direction === "long" ? target > entry : target < entry;
}

/** Whether `candle` closes the position. A candle that touches both stop and
 * target is scored as a stop — there's no way to know the order within a
 * single candle, so assume the worse case. */
export function checkExit(position: FreeTradePosition, candle: Candle, index: number): FreeTradeExit | null {
  const { direction, stop, target } = position;
  const stopHit = direction === "long" ? candle.low <= stop : candle.high >= stop;
  if (stopHit) return { index, price: stop, reason: "stop" };
  const targetHit = direction === "long" ? candle.high >= target : candle.low <= target;
  if (targetHit) return { index, price: target, reason: "target" };
  return null;
}

function resultInR(position: FreeTradePosition, exit: FreeTradeExit): number {
  if (exit.reason === "stop") return -1;
  const risk = Math.abs(position.entry - position.stop);
  const move = position.direction === "long" ? exit.price - position.entry : position.entry - exit.price;
  return move / risk;
}

function pts(n: number): string {
  const r = Math.round(Math.abs(n));
  return `${r} point${r === 1 ? "" : "s"}`;
}

function zoneReason(verdict: Verdict3, price: number, zone: FreeTradePriceZone | FreeTradeTargetZone, noun: string): string {
  if (verdict === "correct") return `Your ${noun} was inside the ideal zone.`;
  const below = price < zone.price_low;
  const distance = below ? zone.price_low - price : price - zone.price_high;
  const where = below ? "below" : "above";
  return verdict === "could_improve"
    ? `Your ${noun} was close, about ${pts(distance)} ${where} the ideal zone.`
    : `Your ${noun} was about ${pts(distance)} ${where} the ideal zone — not anchored to the setup's level.`;
}

function stopReason(verdict: Verdict3, price: number, stop: StopAnswer, direction: FreeTradeDirection): string {
  const protects = direction === "long" ? price <= stop.invalidation_price : price >= stop.invalidation_price;
  if (!protects) {
    const distance = Math.abs(price - stop.invalidation_price);
    return `Your stop was on the wrong side of the swing point that would prove the idea wrong, about ${pts(distance)} inside it — normal noise could take you out before the idea is actually invalidated.`;
  }
  if (verdict === "correct") return "Your stop sat just beyond the swing point that would prove the idea wrong.";
  const extra = Math.abs(price - stop.invalidation_price) - stop.reasonable_buffer;
  return `Your stop protects the trade, but it's about ${pts(extra)} wider than it needs to be, which shrinks your R:R for no benefit.`;
}

export function gradeFreeTrade(
  exercise: FreeTradeExercise,
  position: FreeTradePosition | null,
  exit: FreeTradeExit | null,
): FreeTradeGradeResult {
  const key = exercise.answer;
  const check = (id: FreeTradeCheckId, verdict: Verdict3 | null, reason: string): FreeTradeCheck => ({
    id,
    label: CHECK_LABELS[id],
    verdict,
    reason,
  });

  if (position === null) {
    const decisionVerdict: Verdict3 = key.is_valid_setup ? "incorrect" : "correct";
    const decision = check(
      "decision",
      decisionVerdict,
      key.is_valid_setup ? "There was a valid setup here — sitting out missed it." : "No valid setup formed — sitting out was the right call.",
    );
    const na = "No trade taken.";
    const checks = [
      check("direction", null, na),
      check("entry", null, na),
      check("stop", null, na),
      check("target", null, na),
      check("rr", null, na),
      decision,
    ];
    return {
      verdict: decisionVerdict,
      passed: decisionVerdict !== "incorrect",
      outcome: "no_trade",
      resultR: null,
      rr: null,
      minRR: key.min_rr,
      checks,
      explanation: exercise.explanation,
    };
  }

  const { direction, entry, stop, target, entryIndex } = position;
  const dirWord = direction === "long" ? "Long" : "Short";

  const directionVerdict: Verdict3 = key.intended_bias === direction ? "correct" : "incorrect";
  const directionCheck =
    key.intended_bias === "none"
      ? check("direction", "incorrect", "Structure never shifted cleanly — there was no direction worth trading.")
      : key.intended_bias === direction
        ? check("direction", directionVerdict, `${dirWord} matched the ${direction === "long" ? "bullish" : "bearish"} structure.`)
        : check(
            "direction",
            directionVerdict,
            `You went ${direction}, but structure pointed ${key.intended_bias === "long" ? "long (bullish)" : "short (bearish)"}.`,
          );

  let entryVerdict: Verdict3 = "incorrect";
  let entryCheck: FreeTradeCheck;
  if (key.entry_zone === null) {
    entryCheck = check("entry", "incorrect", "There was no valid entry level in this scenario.");
  } else if (entryIndex < key.entry_zone.earliest_index) {
    entryCheck = check("entry", "incorrect", "You entered before the setup had formed.");
  } else {
    entryVerdict = gradeZonePlacement(entry, key.entry_zone);
    entryCheck = check("entry", entryVerdict, zoneReason(entryVerdict, entry, key.entry_zone, "entry"));
  }

  let stopVerdict: Verdict3 = "incorrect";
  let stopCheck: FreeTradeCheck;
  if (key.stop_zone === null) {
    stopCheck = check("stop", null, "No valid setup to anchor a stop to.");
  } else {
    stopVerdict = gradeProtectiveStop(stop, key.stop_zone, direction);
    stopCheck = check("stop", stopVerdict, stopReason(stopVerdict, stop, key.stop_zone, direction));
  }

  let targetVerdict: Verdict3 = "incorrect";
  let targetCheck: FreeTradeCheck;
  if (key.target === null) {
    targetCheck = check("target", null, "There was no liquidity worth targeting here.");
  } else {
    targetVerdict = gradeZonePlacement(target, key.target);
    targetCheck = check(
      "target",
      targetVerdict,
      targetVerdict === "correct"
        ? "Good target — you aimed at the actual liquidity this setup was drawing toward."
        : zoneReason(targetVerdict, target, key.target, "target"),
    );
  }

  const rr = computeRR(direction, entry, stop, target);
  const rrVerdict = gradeRiskReward(rr, key.min_rr);
  const rrCheck = check(
    "rr",
    rrVerdict,
    rrVerdict === "correct"
      ? `${rr!.toFixed(2)}:1 clears the ${key.min_rr}:1 minimum.`
      : `${rr === null ? "—" : `${rr.toFixed(2)}:1`} is below the ${key.min_rr}:1 minimum.`,
  );

  const decisionVerdict: Verdict3 = key.is_valid_setup ? "correct" : "incorrect";
  const decisionCheck = check(
    "decision",
    decisionVerdict,
    key.is_valid_setup ? "There was a valid setup here, and you took a trade." : "There was no valid setup here — the right call was not to trade.",
  );

  const checks = [directionCheck, entryCheck, stopCheck, targetCheck, rrCheck, decisionCheck];
  // Trading a scenario with no valid setup at all is a MAJOR error
  // regardless of how the user's own levels read — there's no real level
  // to have been anchored to either way (docs/CURRICULUM.md).
  const verdict: Verdict3 = !key.is_valid_setup
    ? "incorrect"
    : worstVerdict([directionVerdict, entryVerdict, stopVerdict, targetVerdict, rrVerdict]);

  const outcome: FreeTradeOutcome =
    exit === null || exit.reason === "session_end" ? "open" : exit.reason === "target" ? "win" : "loss";

  return {
    verdict,
    passed: verdict !== "incorrect",
    outcome,
    resultR: exit === null ? null : resultInR(position, exit),
    rr,
    minRR: key.min_rr,
    checks,
    explanation: exercise.explanation,
  };
}
