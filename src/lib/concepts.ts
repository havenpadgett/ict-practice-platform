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
  /** Noun phrase for this concept's zone, used in feedback copy — e.g. "a Fair Value Gap". */
  zoneNoun: string;
  /** Label for the "no zone here" button, always visible regardless of whether one exists. */
  noZoneLabel: string;
};

export const CONCEPTS: Record<Concept, ConceptMeta> = {
  FVG: {
    title: "FVG Practice",
    pickerLabel: "Fair Value Gap",
    pickerDescription: "Spot unfilled imbalances left by a strong expansion candle.",
    zoneNoun: "a Fair Value Gap",
    noZoneLabel: "No FVG present",
  },
  Liquidity: {
    title: "Liquidity Practice",
    pickerLabel: "Liquidity",
    pickerDescription: "Spot resting liquidity above equal highs or below equal lows.",
    zoneNoun: "a liquidity zone",
    noZoneLabel: "No Liquidity Zone present",
  },
};
