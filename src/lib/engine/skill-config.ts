// Everything that decides a classification, in one place and easy to tune.
// Nothing about thresholds, weights or labels is hard-coded anywhere else
// (docs/ENGINE.md → Skill vector). The numbers are first guesses, chosen so
// behaviour is explainable; revisit them with real attempt data.

import type { SkillId } from "@/lib/engine/types";

export type Classification = "foundation" | "developing" | "intermediate" | "advanced";

export const CLASSIFICATION_ORDER: Classification[] = ["foundation", "developing", "intermediate", "advanced"];

export const CLASSIFICATION_LABEL: Record<Classification, string> = {
  foundation: "Foundation",
  developing: "Developing",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

export const CLASSIFICATION_MEANING: Record<Classification, string> = {
  foundation: "Still developing recognition",
  developing: "Concepts understood, context inconsistent",
  intermediate: "Good recognition and context, execution weaknesses",
  advanced: "Consistently strong context and execution",
};

/** Skills grouped by what they say about a trader. Knowing the vocabulary
 * (recognition) is not the same as reading context or executing, and a higher
 * classification is gated on the latter two, so terminology alone can't earn
 * "Advanced". */
export const SKILL_GROUPS: Record<"recognition" | "context" | "execution", SkillId[]> = {
  recognition: ["concept_recognition", "market_structure"],
  context: ["htf_bias", "liquidity", "confluence"],
  execution: ["entry_models", "execution"],
};

/** What each classification needs. A group's score is the mean of its
 * measured skills; `floor` is the lowest any single measured skill in the
 * gated groups may be, so one strong skill can't carry a weak one. */
export const THRESHOLDS: Record<Exclude<Classification, "foundation">, { recognition: number; context: number; execution: number; floor: number }> = {
  developing: { recognition: 0.5, context: 0, execution: 0, floor: 0 },
  intermediate: { recognition: 0.62, context: 0.58, execution: 0, floor: 0.45 },
  advanced: { recognition: 0.7, context: 0.72, execution: 0.7, floor: 0.6 },
};

/** Skill estimation. */
export const ESTIMATE = {
  /** A prior pulling an estimate toward the middle until evidence builds. */
  prior: 0.5,
  priorWeight: 1.0,
  /** Older evidence counts for half as much every this many items per skill. */
  halfLife: 12,
  /** Placement evidence counts for more than one scenario's, since it is
   * built to measure, and fades as practice accumulates. */
  placementWeight: 1.6,
  /** Below this much evidence weight a skill is "not measured yet". */
  minEffective: 1.2,
  /** Fewest measured skills before any classification is given. */
  minMeasuredSkills: 4,
};

/** A skill below this is a weakness worth naming. */
export const WEAK_BELOW = 0.62;
/** A skill at or above this is a strength. */
export const STRONG_FROM = 0.75;

/** Placement test composition: how heavily each task counts in its skill,
 * by kind. Contextual and execution tasks count for more, in line with the
 * classification gates above. */
export const PLACEMENT_TASK_WEIGHT = { recognition: 0.7, context: 1.2, execution: 1.4 } as const;

export const SKILL_BLURB: Record<SkillId, string> = {
  concept_recognition: "Spotting FVGs, order blocks, swings and displacement",
  market_structure: "Reading swings, shifts in structure and sweeps",
  liquidity: "Knowing where stops rest and which pool matters",
  htf_bias: "Reading the higher timeframe and the draw",
  entry_models: "Choosing the right area and entering from it",
  confluence: "Weighing what actually supports a trade, and waiting for confirmation",
  execution: "Stops, targets, risk-to-reward and standing aside",
};
