// The one-sentence reading at the top of /analytics. Uses the adaptive
// engine's confidence-adjusted skill score to pick strongest and weakest,
// and only among concepts with enough attempts, so a 1/1 concept is never
// called anyone's strength.

import { conceptShortName } from "@/lib/concepts";
import { MIN_ATTEMPTS_FOR_ACCURACY } from "@/lib/practice-modes";
import { scoreConcepts } from "@/lib/recommendations";
import type { DbAttempt } from "@/lib/attempts";

const pct = (x: number) => `${Math.round(x * 100)}%`;

export function analyticsInsight(attempts: DbAttempt[], period: string): string {
  const n = attempts.length;
  if (n === 0) return `No attempts ${period}.`;
  if (n < MIN_ATTEMPTS_FOR_ACCURACY) {
    return `${n} attempt${n === 1 ? "" : "s"} ${period}: not enough yet to read anything from.`;
  }
  const correct = attempts.filter((a) => a.is_correct).length;
  const head = `${pct(correct / n)} correct across ${n} attempts ${period}.`;
  const scored = scoreConcepts(attempts).concepts.filter((c) => c.attempts >= MIN_ATTEMPTS_FOR_ACCURACY);
  if (scored.length < 2) {
    return `${head} Practice at least two concepts ${MIN_ATTEMPTS_FOR_ACCURACY}+ times to compare them.`;
  }
  // scoreConcepts sorts weakest first.
  const weakest = scored[0];
  const strongest = scored[scored.length - 1];
  return `${head} Strongest: ${conceptShortName(strongest.concept)} (${pct(strongest.accuracy)} of ${strongest.attempts}). Needs the most work: ${conceptShortName(weakest.concept)} (${pct(weakest.accuracy)} of ${weakest.attempts}).`;
}
