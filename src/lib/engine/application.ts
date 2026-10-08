// Knowledge versus application: the same skill vector, grouped into the five
// layers between knowing the vocabulary and trading it. No second scoring
// system; each layer is the mean of the measured skills behind it, and a
// layer with nothing measured is reported as such, never as a number.

import { measuredSkills, type SkillVector } from "@/lib/engine/skills";
import type { SkillId } from "@/lib/engine/types";

export type LayerId = "concept_knowledge" | "chart_recognition" | "context_reading" | "trade_selection" | "execution";

export const LAYERS: { id: LayerId; label: string; blurb: string; skills: SkillId[]; train: SkillId }[] = [
  { id: "concept_knowledge", label: "Concept Knowledge", blurb: "Knowing what an FVG, order block or displacement is", skills: ["concept_recognition"], train: "concept_recognition" },
  { id: "chart_recognition", label: "Chart Recognition", blurb: "Finding swings, shifts and sweeps on a real chart", skills: ["market_structure"], train: "market_structure" },
  { id: "context_reading", label: "Context Reading", blurb: "Bias and which liquidity matters", skills: ["htf_bias", "liquidity"], train: "htf_bias" },
  { id: "trade_selection", label: "Trade Selection", blurb: "Whether this is a trade at all, and waiting for confirmation", skills: ["confluence"], train: "confluence" },
  { id: "execution", label: "Execution", blurb: "Entry area, stop, target and standing aside", skills: ["entry_models", "execution"], train: "execution" },
];

export type LayerReading = { id: LayerId; label: string; blurb: string; score: number | null; items: number; train: SkillId };

export function applicationLayers(vector: SkillVector): LayerReading[] {
  const measured = new Set(measuredSkills(vector));
  return LAYERS.map((l) => {
    const have = l.skills.filter((s) => measured.has(s));
    const score = have.length === 0 ? null : have.reduce((a, s) => a + (vector[s].score as number), 0) / have.length;
    return { id: l.id, label: l.label, blurb: l.blurb, score, items: have.reduce((a, s) => a + vector[s].items, 0), train: l.train };
  });
}

/** The one sentence the section leads with, or null when the gap isn't
 * there or the layers behind it aren't measured. */
export function knowledgeGap(layers: LayerReading[]): string | null {
  const knowledge = layers.find((l) => l.id === "concept_knowledge");
  const applied = layers.filter((l) => l.id !== "concept_knowledge" && l.score !== null);
  if (!knowledge || knowledge.score === null || applied.length === 0) return null;
  const lowest = [...applied].sort((a, b) => (a.score as number) - (b.score as number))[0];
  const gap = knowledge.score - (lowest.score as number);
  const p = (x: number) => `${Math.round(x * 100)}%`;
  if (gap >= 0.15) return `You know the concepts (${p(knowledge.score)}), but ${lowest.label} is at ${p(lowest.score as number)}. Knowing the terms isn't the same as applying them.`;
  if (gap <= -0.15) return `Your applied skills are ahead of your concept scores: ${lowest.label} is ${p(lowest.score as number)} against ${p(knowledge.score)} for concepts.`;
  return `Your concept knowledge (${p(knowledge.score)}) and your weakest applied layer, ${lowest.label} (${p(lowest.score as number)}), are close.`;
}
