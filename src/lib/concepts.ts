// Per-concept display copy only — no grading logic lives here. The grader
// in grading.ts is identical for every concept; this just centralizes the
// handful of strings that vary by concept so nothing else has to hardcode
// "FVG" or "Liquidity" text.

export type Concept = "FVG" | "Liquidity";

export const CONCEPT_LIST: Concept[] = ["FVG", "Liquidity"];

type ConceptMeta = {
  /** Page heading shown above the exercise, e.g. "FVG Practice". */
  title: string;
  /** Short label for the picker and Dashboard CTA. */
  pickerLabel: string;
  /** One-line description shown on the concept picker. */
  pickerDescription: string;
  /** Label for the "no answer here" button, always visible regardless of
   * whether a real zone/level exists. */
  noAnswerLabel: string;
};

export const CONCEPTS: Record<Concept, ConceptMeta> = {
  FVG: {
    title: "FVG Practice",
    pickerLabel: "Fair Value Gap",
    pickerDescription: "Spot unfilled imbalances left by a strong expansion candle.",
    noAnswerLabel: "No FVG present",
  },
  Liquidity: {
    title: "Liquidity Practice",
    pickerLabel: "Liquidity",
    pickerDescription: "Spot resting liquidity above equal highs or below equal lows.",
    noAnswerLabel: "No Liquidity Level present",
  },
};

/** Safe lookup for a concept value of unknown provenance (e.g. read back
 * from storage) — an unrecognized string falls back to FVG's copy instead
 * of producing undefined and crashing whatever reads .title off the
 * result. Prefer indexing CONCEPTS directly when the value is already
 * known to be a Concept. */
export function getConceptMeta(concept: string): ConceptMeta {
  return CONCEPTS[concept as Concept] ?? CONCEPTS.FVG;
}
