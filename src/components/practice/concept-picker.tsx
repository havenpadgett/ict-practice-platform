import { getPracticeExercises } from "@/data/exercises";
import { CONCEPT_LIST, CONCEPTS, type Concept } from "@/lib/concepts";

export function ConceptPicker({
  onPick,
  onPickAdaptive,
  adaptiveError,
}: {
  onPick: (concept: Concept) => void;
  /** Starts a mixed session weighted toward weak concepts. */
  onPickAdaptive?: () => void;
  adaptiveError?: string | null;
}) {
  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
        What do you want to practice?
      </h1>
      <p className="mt-1 text-sm text-muted">Pick a concept to start a session.</p>

      {onPickAdaptive && (
        <button
          type="button"
          onClick={onPickAdaptive}
          className="mt-6 w-full rounded-lg border border-accent/60 bg-accent/5 p-5 text-left transition-colors hover:bg-accent/10"
        >
          <p className="text-base font-semibold text-foreground">Adaptive mix</p>
          <p className="mt-1 text-sm text-muted">
            10 exercises across concepts, weighted toward the ones you miss most, with some of your stronger ones mixed in.
          </p>
        </button>
      )}
      {adaptiveError && (
        <p className="mt-2 text-sm" style={{ color: "#e2685f" }}>
          {adaptiveError}
        </p>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {CONCEPT_LIST.map((concept) => {
          const meta = CONCEPTS[concept];
          // A concept can exist with nothing practice-ready yet (e.g. only
          // real scenarios still awaiting review).
          const ready = getPracticeExercises(concept).length > 0;
          return (
            <button
              key={concept}
              type="button"
              onClick={() => onPick(concept)}
              disabled={!ready}
              className="rounded-lg border border-line bg-surface p-5 text-left transition-colors hover:bg-background disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-surface"
            >
              <p className="text-base font-semibold text-foreground">
                {meta.pickerLabel}
              </p>
              <p className="mt-1 text-sm text-muted">{ready ? meta.pickerDescription : "No exercises ready yet."}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
