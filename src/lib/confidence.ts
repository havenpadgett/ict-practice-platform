// Confidence versus accuracy. Before submitting, a learner may say how
// sure they are (1 a guess, 2 fairly sure, 3 certain); this turns those
// ratings and the verdicts into the one comparison that matters: being
// confidently wrong. Pure and derived from attempts alone, so it needs no
// table of its own and stays in step with the SQL twin
// (v_confidence_calibration in 20261003120000_attempt_confidence.sql).

import { MIN_ATTEMPTS_FOR_ACCURACY } from "@/lib/practice-modes";

export type Confidence = 1 | 2 | 3;

export const CONFIDENCE_LEVELS: { value: Confidence; label: string; hint: string }[] = [
  { value: 1, label: "Guess", hint: "Not sure at all" },
  { value: 2, label: "Fairly sure", hint: "Leaning one way" },
  { value: 3, label: "Certain", hint: "Would bet on it" },
];

export const CONFIDENCE_LABEL: Record<Confidence, string> = { 1: "Guess", 2: "Fairly sure", 3: "Certain" };

type AttemptLike = { concept: string; is_correct: boolean; confidence?: number | null };

export type LevelCalibration = {
  level: Confidence;
  label: string;
  attempts: number;
  correct: number;
  /** 0-1, or null below MIN_ATTEMPTS_FOR_ACCURACY: a few answers say little. */
  accuracy: number | null;
};

export type ConfidenceSummary = {
  rated: number;
  unrated: number;
  levels: LevelCalibration[];
  /** Answers rated "certain" that were wrong. */
  confidentlyWrong: { count: number; ofCertain: number; byConcept: { concept: string; count: number }[] };
  /** One plain sentence, or null when there's nothing to say yet. */
  insight: string | null;
};

const isConfidence = (c: unknown): c is Confidence => c === 1 || c === 2 || c === 3;

export function summarizeConfidence(attempts: AttemptLike[]): ConfidenceSummary {
  const rated = attempts.filter((a) => isConfidence(a.confidence));
  const levels: LevelCalibration[] = CONFIDENCE_LEVELS.map(({ value, label }) => {
    const at = rated.filter((a) => a.confidence === value);
    const correct = at.filter((a) => a.is_correct).length;
    return { level: value, label, attempts: at.length, correct, accuracy: at.length >= MIN_ATTEMPTS_FOR_ACCURACY ? correct / at.length : null };
  });

  const certainWrong = rated.filter((a) => a.confidence === 3 && !a.is_correct);
  const byConceptMap = new Map<string, number>();
  for (const a of certainWrong) byConceptMap.set(a.concept, (byConceptMap.get(a.concept) ?? 0) + 1);
  const byConcept = [...byConceptMap.entries()].map(([concept, count]) => ({ concept, count })).sort((a, b) => b.count - a.count);

  const certain = levels[2];
  const guess = levels[0];
  const wrongRated = rated.filter((a) => !a.is_correct).length;

  let insight: string | null = null;
  if (rated.length < MIN_ATTEMPTS_FOR_ACCURACY) {
    insight = null;
  } else if (certain.accuracy !== null) {
    const pct = Math.round(certain.accuracy * 100);
    const share = wrongRated > 0 ? ` ${certainWrong.length} of your ${wrongRated} rated misses were answers you were certain about.` : "";
    const gap =
      guess.accuracy !== null && certain.accuracy <= guess.accuracy
        ? " Your certain answers are no more accurate than your guesses, so how sure you feel isn't yet a reliable signal."
        : "";
    insight = `When you were certain, you were right ${pct}% of the time (${certain.attempts} answers).${share}${gap}`;
  } else if (certainWrong.length > 0) {
    insight = `${certainWrong.length} of your ${wrongRated} rated misses were answers you were certain about.`;
  } else {
    insight = `${rated.length} answers rated so far. Keep rating: the pattern shows once you have ${MIN_ATTEMPTS_FOR_ACCURACY} at a level.`;
  }

  return {
    rated: rated.length,
    unrated: attempts.length - rated.length,
    levels,
    confidentlyWrong: { count: certainWrong.length, ofCertain: certain.attempts, byConcept },
    insight,
  };
}
