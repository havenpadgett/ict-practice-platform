// Shared three-state grading verdict (Phase B, docs/APP_PERFECTION_PLAN.md):
// every graded component and every overall attempt verdict lives in this one
// domain — CORRECT / COULD_IMPROVE / INCORRECT — replacing the old
// all-or-nothing boolean. `is_correct` (the attempts table, every SQL view,
// every screen that pre-dates this) stays populated for backward
// compatibility: COULD_IMPROVE still counts as correct, since the process or
// answer was fundamentally sound, just not optimal. Only INCORRECT is false.
//
// Display wording differs by context (Guided Entry/Free Trade use "Process
// passed" language; Recognition uses "Correct"/"Incorrect") — that's a UI
// concern (src/components/verdict.tsx), not part of this shared domain.

export type Verdict3 = "correct" | "could_improve" | "incorrect";

/** The attempts table's boolean column, kept for every existing view,
 * dashboard, and analytics computation that predates the three-state model. */
export function isCorrectForCompat(verdict: Verdict3): boolean {
  return verdict !== "incorrect";
}

/** Combines component verdicts into one overall verdict: worse dominates
 * (one INCORRECT component fails the whole attempt; one COULD_IMPROVE with
 * everything else CORRECT is a pass with room to improve). Mirrors
 * docs/CURRICULUM.md's severity rule: "Never fail a whole attempt because
 * one component was slightly imperfect." */
export function worstVerdict(verdicts: Verdict3[]): Verdict3 {
  if (verdicts.some((v) => v === "incorrect")) return "incorrect";
  if (verdicts.some((v) => v === "could_improve")) return "could_improve";
  return "correct";
}

/** A price placed against a zone with a graduated near-miss band: inside
 * [price_low, price_high] is CORRECT (an entry at the far edge of a valid
 * zone is correct, not wrong — docs/CURRICULUM.md, Guided Entry); within
 * `minor_margin` beyond either edge is a near miss (COULD_IMPROVE); further
 * out is INCORRECT. */
export function gradeZonePlacement(
  price: number,
  zone: { price_low: number; price_high: number; minor_margin: number },
): Verdict3 {
  if (price >= zone.price_low && price <= zone.price_high) return "correct";
  const distance = price < zone.price_low ? zone.price_low - price : price - zone.price_high;
  return distance <= zone.minor_margin ? "could_improve" : "incorrect";
}

/** A protective stop, graded on whether it protects the trade rather than
 * on distance from a reference price (docs/CURRICULUM.md: "The question is
 * whether it protects the trade, not whether it matches a reference
 * price."). Beyond `invalidation_price` (away from entry) always protects;
 * within `reasonable_buffer` of it is a clean stop (CORRECT). Further out —
 * however far — is still protecting, just not optimal (COULD_IMPROVE: a
 * wide stop never fails on width alone). On the wrong side — it wouldn't
 * actually trigger before the idea is already invalidated — is always
 * INCORRECT, regardless of how close. */
export function gradeProtectiveStop(
  price: number,
  stop: { invalidation_price: number; reasonable_buffer: number },
  direction: "long" | "short",
): Verdict3 {
  const protects = direction === "long" ? price <= stop.invalidation_price : price >= stop.invalidation_price;
  if (!protects) return "incorrect";
  const distanceBeyond = Math.abs(price - stop.invalidation_price);
  return distanceBeyond <= stop.reasonable_buffer ? "correct" : "could_improve";
}

/** Risk-to-reward severity: below `moderateFloor` (a fraction of the
 * minimum — "the best available risk-to-reward is below 2:1" is a MAJOR
 * failure per the curriculum) is INCORRECT; between the floor and the
 * minimum is a near miss (COULD_IMPROVE — "weak R:R"); at or above the
 * minimum is CORRECT. Null (no real risk, e.g. a stop on the wrong side of
 * entry) is always INCORRECT. */
const RR_MODERATE_FRACTION = 0.75;
export function gradeRiskReward(achievedRR: number | null, minRR: number): Verdict3 {
  if (achievedRR === null) return "incorrect";
  if (achievedRR >= minRR) return "correct";
  return achievedRR >= minRR * RR_MODERATE_FRACTION ? "could_improve" : "incorrect";
}

/** The clean/correct stop band (invalidation_price to invalidation_price ±
 * reasonable_buffer) as a price_low/price_high pair, for drawing the
 * reference zone on a chart — the same shape a protective stop is graded
 * against in gradeProtectiveStop above. */
export function protectiveStopBand(
  stop: { invalidation_price: number; reasonable_buffer: number },
  direction: "long" | "short",
): { price_low: number; price_high: number } {
  return direction === "long"
    ? { price_low: stop.invalidation_price - stop.reasonable_buffer, price_high: stop.invalidation_price }
    : { price_low: stop.invalidation_price, price_high: stop.invalidation_price + stop.reasonable_buffer };
}
