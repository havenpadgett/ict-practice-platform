import { AccuracyBar } from "@/components/analytics/accuracy-bar";
import { CONCEPT_LIST, CONCEPTS } from "@/lib/concepts";

export function ConceptAccuracyBars({ byConcept }: { byConcept: Record<string, number> }) {
  const concepts = CONCEPT_LIST.filter((concept) => byConcept[concept] !== undefined);
  if (concepts.length === 0) return null;

  return (
    <div className="space-y-4">
      {concepts.map((concept) => (
        <AccuracyBar
          key={concept}
          label={CONCEPTS[concept].pickerLabel}
          accuracy={byConcept[concept]}
        />
      ))}
    </div>
  );
}
