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

import type { Candle, FreeTradeDirection, FreeTradeExercise } from "@/data/exercises";

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

export type FreeTradeCheckId = "direction" | "entry" | "stop" | "rr" | "decision";

export type FreeTradeCheck = {
  id: FreeTradeCheckId;
  label: string;
  /** "na" when the check doesn't apply (e.g. entry/stop when no trade was
   * taken) — recorded as null, not false. */
  status: "pass" | "fail" | "na";
  reason: string;
};

export type FreeTradeGradeResult = {
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

function inZone(price: number, zone: { price_low: number; price_high: number }): boolean {
  return price >= zone.price_low && price <= zone.price_high;
}

function formatRR(rr: number): string {
  return `${rr.toFixed(2)}:1`;
}

export function gradeFreeTrade(
  exercise: FreeTradeExercise,
  position: FreeTradePosition | null,
  exit: FreeTradeExit | null,
): FreeTradeGradeResult {
  const key = exercise.answer;
  const check = (id: FreeTradeCheckId, status: FreeTradeCheck["status"], reason: string): FreeTradeCheck => ({
    id,
    label: CHECK_LABELS[id],
    status,
    reason,
  });

  if (position === null) {
    const decision = key.is_valid_setup
      ? check("decision", "fail", "There was a valid setup here — sitting out missed it.")
      : check("decision", "pass", "No valid setup formed — sitting out was the right call.");
    const na = "No trade taken.";
    const checks = [
      check("direction", "na", na),
      check("entry", "na", na),
      check("stop", "na", na),
      check("rr", "na", na),
      decision,
    ];
    return {
      passed: decision.status === "pass",
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

  const directionCheck =
    key.intended_bias === "none"
      ? check("direction", "fail", "Structure never shifted cleanly — there was no direction worth trading.")
      : key.intended_bias === direction
        ? check("direction", "pass", `${dirWord} matched the ${direction === "long" ? "bullish" : "bearish"} structure.`)
        : check(
            "direction",
            "fail",
            `You went ${direction}, but structure pointed ${key.intended_bias === "long" ? "long (bullish)" : "short (bearish)"}.`,
          );

  const entryCheck =
    key.entry_zone === null
      ? check("entry", "fail", "There was no valid entry level in this scenario.")
      : entryIndex < key.entry_zone.earliest_index
        ? check("entry", "fail", "You entered before the setup had formed.")
        : inZone(entry, key.entry_zone)
          ? check("entry", "pass", "Your entry was inside the ideal zone.")
          : check("entry", "fail", "Your entry was outside the ideal zone — it wasn't anchored to the setup's level.");

  let stopCheck: FreeTradeCheck;
  if (key.stop_zone === null) {
    stopCheck = check("stop", "na", "No valid setup to anchor a stop to.");
  } else if (inZone(stop, key.stop_zone)) {
    stopCheck = check("stop", "pass", "Your stop sat just beyond the swing point that would prove the idea wrong.");
  } else {
    const tooTight = direction === "long" ? stop > key.stop_zone.price_high : stop < key.stop_zone.price_low;
    stopCheck = tooTight
      ? check("stop", "fail", "Your stop was too tight — inside the swing point that formed the setup, so normal noise can take you out.")
      : check("stop", "fail", "Your stop was further than needed beyond the swing point, which shrinks your R:R for no benefit.");
  }

  const rr = computeRR(direction, entry, stop, target);
  const rrCheck =
    rr !== null && rr >= key.min_rr
      ? check("rr", "pass", `${formatRR(rr)} clears the ${key.min_rr}:1 minimum.`)
      : check("rr", "fail", `${rr === null ? "—" : formatRR(rr)} is below the ${key.min_rr}:1 minimum.`);

  const decisionCheck = key.is_valid_setup
    ? check("decision", "pass", "There was a valid setup here, and you took a trade.")
    : check("decision", "fail", "There was no valid setup here — the right call was not to trade.");

  const checks = [directionCheck, entryCheck, stopCheck, rrCheck, decisionCheck];
  const passed = checks.every((c) => c.status !== "fail");

  const outcome: FreeTradeOutcome =
    exit === null || exit.reason === "session_end" ? "open" : exit.reason === "target" ? "win" : "loss";

  return {
    passed,
    outcome,
    resultR: exit === null ? null : resultInR(position, exit),
    rr,
    minRR: key.min_rr,
    checks,
    explanation: exercise.explanation,
  };
}
