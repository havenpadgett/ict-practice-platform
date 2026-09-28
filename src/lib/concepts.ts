// Per-concept display copy only — no grading logic lives here. The grader
// in grading.ts is identical for every concept; this just centralizes the
// handful of strings that vary by concept so nothing else has to hardcode
// "FVG" or "Liquidity" text.

export type Concept =
  | "FVG"
  | "Liquidity"
  | "MSS"
  | "IFVG"
  | "GuidedEntry"
  | "FreeTrade"
  | "TimeLiquidity"
  | "PremiumDiscount"
  | "OrderBlock";

export const CONCEPT_LIST: Concept[] = [
  "FVG",
  "Liquidity",
  "MSS",
  "IFVG",
  "OrderBlock",
  "TimeLiquidity",
  "PremiumDiscount",
  "GuidedEntry",
  "FreeTrade",
];

type ConceptMeta = {
  /** Page heading shown above the exercise, e.g. "FVG Practice". */
  title: string;
  /** Short label for the picker and Dashboard CTA. */
  pickerLabel: string;
  /** One-line description shown on the concept picker. */
  pickerDescription: string;
  /** Standard abbreviation, where traders use one (FVG, IFVG, MSS). */
  abbr?: string;
  /** The rule in two or three plain sentences, for "Show me why" after an
   * answer. Summarizes docs/CURRICULUM.md; that file is the source. */
  rule?: string;
};

export const CONCEPTS: Record<Concept, ConceptMeta> = {
  FVG: {
    title: "FVG Practice",
    pickerLabel: "Fair Value Gap",
    pickerDescription: "Spot unfilled imbalances left by a strong expansion candle.",
    abbr: "FVG",
    rule: "Three candles where the first and third don't overlap. In a bullish gap, candle 1's high sits below candle 3's low; in a bearish gap, candle 1's low sits above candle 3's high. The gap is the price range between those two wicks, left open by the strong middle candle.",
  },
  Liquidity: {
    title: "Liquidity Practice",
    pickerLabel: "Liquidity",
    pickerDescription: "Spot the strongest resting liquidity above highs or below lows.",
    rule: "Stops rest above swing highs (buy-side) and below swing lows (sell-side), so price is drawn toward them. Two or more highs or lows at the same price hold a bigger pool than a single swing, which is why equal highs and lows count as the strongest.",
  },
  MSS: {
    title: "MSS Practice",
    pickerLabel: "Market Structure Shift",
    pickerDescription: "Mark the swing level whose break confirmed a shift in trend.",
    abbr: "MSS",
    rule: "In a trend, price fails to make a new extreme and then a candle body closes through the most recent swing that held the trend: the last higher low in an uptrend, the last lower high in a downtrend. A wick through doesn't count, and neither does breaking a minor internal swing.",
  },
  IFVG: {
    title: "IFVG Practice",
    pickerLabel: "Inverse Fair Value Gap",
    pickerDescription: "Spot a Fair Value Gap that failed and now acts as the opposite level.",
    abbr: "IFVG",
    rule: "A Fair Value Gap that a candle body closed through, beyond its far edge. Once it fails, the same price range tends to act from the other side: a failed bullish gap becomes resistance, a failed bearish gap support.",
  },
  OrderBlock: {
    title: "Order Block Practice",
    pickerLabel: "Order Block",
    pickerDescription: "Mark the last opposing candle before a displacement that broke structure.",
    rule: "The last opposing candle before a displacement that breaks a swing: the last down-close candle before a strong move up, or the last up-close candle before a strong move down. The zone is that candle's full high-to-low range.",
  },
  TimeLiquidity: {
    title: "Time-Based Liquidity Practice",
    pickerLabel: "Time-Based Liquidity",
    pickerDescription: "Mark previous-day, NY AM session and weekly highs and lows.",
    rule: "The highs and lows of fixed periods: the previous trading day, the New York AM session (9:30 to 11:00 ET) and the previous week. Everyone can see them, so stops cluster just beyond them.",
  },
  PremiumDiscount: {
    title: "Premium & Discount Practice",
    pickerLabel: "Premium & Discount",
    pickerDescription: "Read where price sits in its dealing range: premium, discount, or equilibrium.",
    rule: "Take the dealing range from the swing low to the swing high. A last close above the midpoint is premium, below it discount. A close within 5% of the range either side of the midpoint is at equilibrium, where location alone gives no edge.",
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

/** Full name with its abbreviation, for headings: "Fair Value Gap (FVG)". */
export function conceptDisplayName(concept: string): string {
  const meta = getConceptMeta(concept);
  return meta.abbr ? `${meta.pickerLabel} (${meta.abbr})` : meta.pickerLabel;
}

/** The compact name, for buttons and tight labels: "FVG", "Order Block". */
export function conceptShortName(concept: string): string {
  const meta = getConceptMeta(concept);
  return meta.abbr ?? meta.pickerLabel;
}

export const DIFFICULTY_LABELS = { 1: "Easy", 2: "Medium", 3: "Hard" } as const;
