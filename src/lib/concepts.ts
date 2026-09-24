// Per-concept display copy only — no grading logic lives here. The grader
// in grading.ts is identical for every concept; this just centralizes the
// handful of strings that vary by concept so nothing else has to hardcode
// "FVG" or "Liquidity" text.

export type Concept = "FVG" | "Liquidity" | "MSS" | "IFVG" | "GuidedEntry" | "FreeTrade";

export const CONCEPT_LIST: Concept[] = ["FVG", "Liquidity", "MSS", "IFVG", "GuidedEntry", "FreeTrade"];

type ConceptMeta = {
  /** Page heading shown above the exercise, e.g. "FVG Practice". */
  title: string;
  /** Short label for the picker and Dashboard CTA. */
  pickerLabel: string;
  /** One-line description shown on the concept picker. */
  pickerDescription: string;
};

export const CONCEPTS: Record<Concept, ConceptMeta> = {
  FVG: {
    title: "FVG Practice",
    pickerLabel: "Fair Value Gap",
    pickerDescription: "Spot unfilled imbalances left by a strong expansion candle.",
  },
  Liquidity: {
    title: "Liquidity Practice",
    pickerLabel: "Liquidity",
    pickerDescription: "Spot the strongest resting liquidity above highs or below lows.",
  },
  MSS: {
    title: "MSS Practice",
    pickerLabel: "Market Structure Shift",
    pickerDescription: "Mark the swing level whose break confirmed a shift in trend.",
  },
  IFVG: {
    title: "IFVG Practice",
    pickerLabel: "Inverse Fair Value Gap",
    pickerDescription: "Spot a Fair Value Gap that failed and now acts as the opposite level.",
  },
  GuidedEntry: {
    title: "Guided Entry Practice",
    pickerLabel: "Guided Entry",
    pickerDescription: "Build a full trade idea step by step: bias, entry, stop, and target.",
  },
  FreeTrade: {
    title: "Free Trade",
    pickerLabel: "Free Trade",
    pickerDescription: "Play a chart forward candle by candle and decide if and when to trade.",
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
