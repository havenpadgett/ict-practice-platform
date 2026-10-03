import { ConfidencePicker } from "@/components/confidence-picker";
import type { ChoiceOption } from "@/data/exercises";
import type { Confidence } from "@/lib/confidence";

export function ChoiceControls({
  options,
  selected,
  onSelect,
  onSubmit,
  canSubmit,
  confidence,
  onConfidenceChange,
}: {
  options: ChoiceOption[];
  selected: string | null;
  onSelect: (value: string) => void;
  onSubmit: () => void;
  canSubmit: boolean;
  confidence?: Confidence | null;
  onConfidenceChange?: (value: Confidence | null) => void;
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
      {onConfidenceChange && <ConfidencePicker className="mt-5" value={confidence ?? null} onChange={onConfidenceChange} />}
      <div className="mt-5 flex border-t border-line pt-5">
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
