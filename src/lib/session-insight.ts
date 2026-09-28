// The one-line takeaway on the session summary: where the misses came
// from, in words. Pure, so it's testable without a page.

import { conceptShortName } from "@/lib/concepts";

export type SessionOutcome = { exercise_id: string; correct: boolean; failure_reason: string | null };

/** What a failure reason means, as a short phrase. */
const FAILURE_PHRASES: Record<string, string> = {
  coverage: "box in the wrong place",
  too_small: "box drawn too small",
  precision: "box drawn too wide",
  time: "box over the wrong candles",
  off_level: "line outside the tolerance",
  wrong_choice: "misread the chart",
  missed_answer: "missed a setup that was there",
  false_positive: "marked a setup that wasn't there",
};

function failurePhrase(reason: string | null, concept: string): string {
  if (reason && FAILURE_PHRASES[reason]) return FAILURE_PHRASES[reason];
  if (concept === "GuidedEntry" || concept === "FreeTrade") return "trade plan";
  return "wrong answer";
}

function list(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

const NUMBERS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
const num = (n: number) => NUMBERS[n] ?? String(n);

/** e.g. "You got every Liquidity chart right. Both misses were in FVG: box
 * drawn too wide." */
export function sessionInsight(outcomes: SessionOutcome[], conceptOf: (id: string) => string | undefined): string {
  if (outcomes.length === 0) return "";
  const misses = outcomes.filter((o) => !o.correct);
  if (misses.length === 0) {
    return outcomes.length >= 5
      ? "Every answer correct. Next time, try a harder difficulty or a mixed session."
      : "Every answer correct.";
  }

  const byConcept = new Map<string, { total: number; missed: SessionOutcome[] }>();
  for (const o of outcomes) {
    const c = conceptOf(o.exercise_id) ?? "";
    const entry = byConcept.get(c) ?? { total: 0, missed: [] };
    entry.total += 1;
    if (!o.correct) entry.missed.push(o);
    byConcept.set(c, entry);
  }

  const reasons = new Map<string, number>();
  for (const m of misses) {
    const phrase = failurePhrase(m.failure_reason, conceptOf(m.exercise_id) ?? "");
    reasons.set(phrase, (reasons.get(phrase) ?? 0) + 1);
  }
  const reasonText =
    reasons.size === 1
      ? [...reasons.keys()][0]
      : list([...reasons.entries()].sort((a, b) => b[1] - a[1]).map(([p, n]) => `${p} (${n})`));

  const missWord = misses.length === 1 ? "The miss" : misses.length === 2 ? "Both misses" : `All ${num(misses.length)} misses`;
  const missedConcepts = [...byConcept.entries()].filter(([, v]) => v.missed.length > 0).map(([c]) => c);

  if (byConcept.size === 1) {
    return `${missWord}: ${reasonText}.`;
  }

  const clean = [...byConcept.entries()].filter(([, v]) => v.missed.length === 0 && v.total >= 2).map(([c]) => conceptShortName(c));
  const strength = clean.length > 0 ? `You got every ${list(clean)} chart right. ` : "";
  if (missedConcepts.length === 1) {
    return `${strength}${missWord} ${misses.length === 1 ? "was" : "were"} in ${conceptShortName(missedConcepts[0])}: ${reasonText}.`;
  }
  return `${strength}Misses came from ${list(missedConcepts.map(conceptShortName))}. Most common: ${[...reasons.entries()].sort((a, b) => b[1] - a[1])[0][0]}.`;
}
