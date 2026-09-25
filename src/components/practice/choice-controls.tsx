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
    <div>
      <div className="flex flex-wrap gap-3">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onSelect(option.value)}
            aria-pressed={selected === option.value}
            className="btn-option"
          >
            {option.label}
          </button>
        ))}
      </div>
      {/* Submit is a commit action, not another option in the group above —
          a separate, top-bordered row keeps it from being mistaken for one
          more choice and prevents mis-clicks right after selecting. */}
      <div className="mt-5 flex justify-end border-t border-line pt-4">
        <button
          type="button"
          onClick={onSubmit}
          disabled={!canSubmit}
          className="btn-primary"
        >
          Submit
        </button>
      </div>
    </div>
  );
}
