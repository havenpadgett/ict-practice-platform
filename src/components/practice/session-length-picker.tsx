import { getAvailableSessionLengths, type SessionLength } from "@/data/exercises";
import { CONCEPTS, type Concept } from "@/lib/concepts";

export function SessionLengthPicker({
  concept,
  onPick,
  onBack,
}: {
  concept: Concept;
  onPick: (length: SessionLength) => void;
  onBack: () => void;
}) {
  const lengths = getAvailableSessionLengths(concept);

  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
        {CONCEPTS[concept].pickerLabel}
      </h1>
      <p className="mt-1 text-sm text-muted">How many exercises do you want to practice?</p>

      <div className="mt-6 flex flex-wrap gap-3">
        {lengths.map((length) => (
          <button
            key={String(length)}
            type="button"
            onClick={() => onPick(length)}
            className="rounded-lg border border-line bg-surface px-6 py-4 text-sm font-medium text-foreground transition-colors hover:bg-background"
          >
            {length === "all" ? "All exercises" : `${length} exercises`}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={onBack}
        className="mt-4 -ml-2 inline-flex min-h-11 min-w-11 items-center px-2 text-sm text-muted underline-offset-2 hover:underline"
      >
        Back
      </button>
    </div>
  );
}
