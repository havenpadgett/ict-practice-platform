// The concept taxonomy and its mastery (docs/ENGINE.md → Skill tree). Five
// active groups, a mastery bar per concept, and each bar launches practice.
// SMT is in the taxonomy and marked coming later: it is excluded from every
// mastery figure and nothing in this pass builds it.

import type { Concept } from "@/lib/concepts";
import type { StoredScenarioAttempt } from "@/lib/engine/attempt-row";
import { attemptsOn, masteryFrom, pickLeastRecent, scoresFor, type Mastery } from "@/lib/engine/mastery";
import type { ScenarioMeta } from "@/lib/engine/store";
import type { Dimension } from "@/lib/engine/types";

export type TreeConcept = {
  id: string;
  label: string;
  blurb: string;
  /** Scenarios with any of these tags exercise it. */
  tags: string[];
  /** The process dimensions that measure it, where it has its own. */
  dimensions: Dimension[];
  /** Recognition-exercise concepts (the older practice) that train it. */
  recognition?: Concept[];
  /** In the taxonomy, not built, and never scored. */
  comingLater?: boolean;
};

export type TreeGroup = { id: string; label: string; concepts: TreeConcept[] };

export const SKILL_TREE: TreeGroup[] = [
  {
    id: "foundations",
    label: "Market Foundations",
    concepts: [
      { id: "structure", label: "Structure", blurb: "Swings, and what counts as a real break of one", tags: ["mss", "structure", "wick", "false-structure", "false-mss", "htf-shift"], dimensions: ["confirmation"], recognition: ["MSS"] },
      { id: "liquidity", label: "Liquidity", blurb: "Where stops rest and which pool matters", tags: ["sweep", "liquidity", "equal-highs", "equal-lows", "session-liquidity", "weekly-low"], dimensions: ["liquidity_read"], recognition: ["Liquidity", "TimeLiquidity"] },
      { id: "displacement", label: "Displacement", blurb: "A move that takes out structure, versus drift", tags: ["displacement", "no-displacement", "false-mss", "no-liquidity"], dimensions: [] },
    ],
  },
  {
    id: "pd-arrays",
    label: "PD Arrays",
    concepts: [
      { id: "fvg", label: "FVG", blurb: "Three-candle imbalance, and which one carries the trade", tags: ["fvg", "which-fvg"], dimensions: ["poi_selection"], recognition: ["FVG"] },
      { id: "ifvg", label: "IFVG", blurb: "A gap that failed and flipped", tags: ["ifvg"], dimensions: [], recognition: ["IFVG"] },
      { id: "ob", label: "Order block", blurb: "The last opposing candle before the move", tags: ["order-block"], dimensions: ["poi_selection"], recognition: ["OrderBlock"] },
      { id: "breaker", label: "Breaker", blurb: "An order block that failed", tags: ["breaker"], dimensions: [] },
      { id: "mitigation", label: "Mitigation", blurb: "Price returning to an array and reacting", tags: ["mitigation"], dimensions: [] },
    ],
  },
  {
    id: "context",
    label: "Context",
    concepts: [
      { id: "premium-discount", label: "Premium and discount", blurb: "Where price sits in its range, and why it changes the trade", tags: ["location", "premium", "discount", "room-to-draw"], dimensions: [], recognition: ["PremiumDiscount"] },
      { id: "dealing-range", label: "Dealing range", blurb: "The swing range price is working inside", tags: ["location", "htf-range", "reversal"], dimensions: [] },
      { id: "htf-bias", label: "HTF bias", blurb: "Reading the higher timeframe, including 'no bias'", tags: ["htf-bias", "no-bias", "conflict", "supply", "counter-trend", "htf-fvg"], dimensions: ["htf_bias"] },
      { id: "draw", label: "Draw on liquidity", blurb: "Which pool price is after, internal or external", tags: ["pdh-draw", "pdl-draw", "internal-liquidity", "external-liquidity", "draw", "asia-range", "session-high"], dimensions: ["liquidity_read"] },
    ],
  },
  {
    id: "confirmation",
    label: "Confirmation",
    concepts: [
      { id: "sweep", label: "Sweep", blurb: "Liquidity taken, and what has to follow it", tags: ["sweep", "fake-sweep", "stop-hunt", "session-liquidity"], dimensions: [] },
      { id: "mss", label: "MSS", blurb: "A body close through the swing", tags: ["mss", "wick", "false-mss", "no-confirmation", "confirmation"], dimensions: ["confirmation"], recognition: ["MSS"] },
      { id: "cisd", label: "CISD", blurb: "Change in state of delivery", tags: ["cisd"], dimensions: [] },
    ],
  },
  {
    id: "execution",
    label: "Execution",
    concepts: [
      { id: "entry", label: "Entry", blurb: "The right area, and entering from it", tags: ["fvg", "order-block", "limit-order", "late-entry", "second-chance", "patience"], dimensions: ["entry_location"] },
      { id: "stop", label: "Stop", blurb: "Where the idea is proven wrong", tags: ["stop-placement", "stop-hunt", "failed-setup", "process"], dimensions: ["stop_placement"] },
      { id: "target", label: "Target", blurb: "Aiming at liquidity, not a round multiple", tags: ["target", "target-selection", "pdh-draw", "pdl-draw", "internal-liquidity", "external-liquidity", "multiple-valid"], dimensions: ["target_selection"] },
      { id: "rr", label: "Risk to reward", blurb: "Room to the draw against the distance to the stop", tags: ["room-to-draw", "target", "location"], dimensions: ["target_selection"] },
      { id: "no-trade", label: "No trade", blurb: "Standing aside when nothing is worth taking", tags: ["no-trade", "chop", "consolidation", "no-bias", "post-expansion"], dimensions: ["trade_selection"] },
    ],
  },
  {
    id: "smt",
    label: "SMT divergence",
    concepts: [{ id: "smt", label: "SMT", blurb: "Divergence across correlated instruments. Needs a second instrument, so it's coming later and isn't scored.", tags: [], dimensions: [], comingLater: true }],
  },
];

export const ACTIVE_CONCEPTS: TreeConcept[] = SKILL_TREE.flatMap((g) => g.concepts).filter((c) => !c.comingLater);

export function scenariosFor(concept: TreeConcept, catalog: ScenarioMeta[]): ScenarioMeta[] {
  return catalog.filter((m) => m.tags.some((t) => concept.tags.includes(t)));
}

export type ConceptMastery = Mastery & {
  scenarios: number;
  /** Recognition exercises that count toward it, from the older practice. */
  recognitionAttempts: number;
};

/** Mastery of a concept: process scores on the scenarios that exercise it
 * (the dimension that measures it, where it has one), pooled with accuracy on
 * the recognition exercises that train it. Never computed for SMT. */
export function conceptMastery(
  concept: TreeConcept,
  attempts: StoredScenarioAttempt[],
  catalog: ScenarioMeta[],
  recognition: { concept: string; attempts: number; accuracy: number }[] = [],
): ConceptMastery {
  if (concept.comingLater) return { score: null, items: 0, scenarios: 0, recognitionAttempts: 0 };
  const pool = scenariosFor(concept, catalog);
  const scores = scoresFor(attemptsOn(attempts, catalog, (m) => pool.some((p) => p.id === m.id)), concept.dimensions);
  let recognitionAttempts = 0;
  for (const r of recognition) {
    if (!concept.recognition?.includes(r.concept as Concept)) continue;
    recognitionAttempts += r.attempts;
    // Each recognition attempt counts as one item at the concept's accuracy.
    for (let i = 0; i < Math.min(r.attempts, 10); i++) scores.push(r.accuracy);
  }
  return { ...masteryFrom(scores), scenarios: pool.length, recognitionAttempts };
}

/** Where a click on a concept's bar goes: a scenario to practise, or a
 * recognition session when no scenario carries it. */
export function practiceFor(concept: TreeConcept, attempts: StoredScenarioAttempt[], catalog: ScenarioMeta[]): { href: string; label: string } | null {
  if (concept.comingLater) return null;
  const pick = pickLeastRecent(scenariosFor(concept, catalog), attempts);
  if (pick) {
    const mode = pick.modes.includes("simulator") ? "simulator" : pick.modes[0];
    return { href: `/train/play?mode=${mode}&scenario=${pick.id}`, label: `Practise ${concept.label}` };
  }
  const rec = concept.recognition?.[0];
  return rec ? { href: `/practice?concept=${rec}`, label: `Practise ${concept.label}` } : null;
}
