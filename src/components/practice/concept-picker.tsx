import { CONCEPT_LIST, CONCEPTS, type Concept } from "@/lib/concepts";

export function ConceptPicker({
  onPick,
}: {
  onPick: (concept: Concept) => void;
}) {
  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
        What do you want to practice?
      </h1>
      <p className="mt-1 text-sm text-muted">Pick a concept to start a session.</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {CONCEPT_LIST.map((concept) => {
          const meta = CONCEPTS[concept];
          return (
            <button
              key={concept}
              type="button"
              onClick={() => onPick(concept)}
              className="rounded-lg border border-line bg-surface p-5 text-left transition-colors hover:bg-background"
            >
              <p className="text-base font-semibold text-foreground">
                {meta.pickerLabel}
              </p>
              <p className="mt-1 text-sm text-muted">{meta.pickerDescription}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
