import type { ConceptHighlight } from "@/lib/analytics";
import { CONCEPTS, type Concept } from "@/lib/concepts";

function conceptLabel(concept: string): string {
  return CONCEPTS[concept as Concept]?.pickerLabel ?? concept;
}

export function ConceptHighlights({
  strongest,
  weakest,
}: {
  strongest: ConceptHighlight;
  weakest: ConceptHighlight;
}) {
  const onlyOneConcept = strongest.concept === weakest.concept;

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-line bg-surface p-4 sm:p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Strongest</p>
          <p className="mt-2 text-lg font-semibold text-foreground">
            {conceptLabel(strongest.concept)}
          </p>
          <p className="mt-1 text-sm text-muted">{strongest.accuracy}% accuracy</p>
        </div>
        <div className="rounded-lg border border-line bg-surface p-4 sm:p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Weakest</p>
          <p className="mt-2 text-lg font-semibold text-foreground">
            {conceptLabel(weakest.concept)}
          </p>
          <p className="mt-1 text-sm text-muted">{weakest.accuracy}% accuracy</p>
        </div>
      </div>
      {onlyOneConcept && (
        <p className="mt-2 text-xs text-muted">
          Only one concept has attempts recorded so far — practice both to see a real comparison.
        </p>
      )}
    </div>
  );
}
