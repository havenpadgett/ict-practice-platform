import type { ChoiceOption } from "@/data/exercises";

export function ChoiceControls({
  options,
  selected,
  onSelect,
  onSubmit,
  canSubmit,
}: {
  options: ChoiceOption[];
  selected: string | null;
  onSelect: (value: string) => void;
  onSubmit: () => void;
  canSubmit: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex flex-wrap gap-3">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onSelect(option.value)}
            aria-pressed={selected === option.value}
            className={`inline-flex items-center justify-center rounded-md border px-6 py-2.5 text-sm font-medium transition-colors ${
              selected === option.value
                ? "border-accent bg-accent/10 text-accent"
                : "border-line text-foreground hover:bg-surface"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={onSubmit}
        disabled={!canSubmit}
        className="inline-flex items-center justify-center rounded-md bg-accent px-6 py-2.5 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Submit
      </button>
    </div>
  );
}
