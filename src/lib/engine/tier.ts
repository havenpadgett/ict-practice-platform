// How much an explanation says depends on who is reading it (docs/ENGINE.md →
// Explanations that mature with skill). Beginners get terminology defined,
// intermediate learners get how the pieces relate, and advanced traders get
// context and decision-making: an advanced reader is never told what an FVG
// is. The tier follows the classification once there is one, and the
// beginner / experienced preference until then.

import type { Experience } from "@/lib/experience";
import type { ExplanationTier } from "@/lib/engine/kind-definitions";
import type { Classification } from "@/lib/engine/skill-config";

export function explanationTier(classification: Classification | null, experience: Experience): ExplanationTier {
  if (classification === "advanced") return "decide";
  if (classification === "intermediate" || classification === "developing") return "relate";
  if (classification === "foundation") return "define";
  return experience === "experienced" ? "relate" : "define";
}
