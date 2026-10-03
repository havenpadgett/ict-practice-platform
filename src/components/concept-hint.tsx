"use client";

import { GlossaryText } from "@/components/glossary/glossary-text";
import { useExperience } from "@/contexts/experience-context";
import { getConceptMeta } from "@/lib/concepts";
import { behavior } from "@/lib/experience";

/** Beginners only: what to look for, from the concept's own written rule
 * (src/lib/concepts.ts), above the chart before they answer. It states the
 * definition, never anything about the chart in front of them. */
export function ConceptHint({ concept }: { concept: string }) {
  const { level } = useExperience();
  const rule = getConceptMeta(concept).rule;
  if (!behavior(level).showConceptHint || !rule) return null;
  return (
    <details open className="mb-5 rounded-lg border border-line bg-surface px-4 py-3">
      <summary className="cursor-pointer text-sm font-medium text-foreground">What to look for</summary>
      <p className="mt-2 text-sm text-muted">
        <GlossaryText text={rule} />
      </p>
    </details>
  );
}
