import type { GuidedBias } from "@/data/exercises";

const OPTIONS: { value: GuidedBias; label: string }[] = [
  { value: "bullish", label: "Bullish" },
  { value: "bearish", label: "Bearish" },
  { value: "unclear", label: "Unclear" },
];

export function GuidedBiasControls({
  selected,
  onSelect,
  onContinue,
  onNoTrade,
}: {
  selected: GuidedBias | null;
  onSelect: (bias: GuidedBias) => void;
  onContinue: () => void;
  onNoTrade: () => void;
}) {
  return (
    <div>
      <div className="flex flex-wrap gap-3">
        {OPTIONS.map((option) => (
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
      {/* Continue is a commit action, not another option in the group above —
          a separate, top-bordered row keeps it from being mistaken for one
          more choice and prevents mis-clicks right after selecting. */}
      <div className="mt-5 flex flex-wrap items-center justify-end gap-3 border-t border-line pt-4">
        {/* Available at every step (PRD) — a persistent way to bail out the
            moment "no valid setup" becomes clear, without forcing the user
            through steps that no longer mean anything. */}
        <button
          type="button"
          onClick={onNoTrade}
          className="btn-secondary"
        >
          No Trade
        </button>
        <button
          type="button"
          onClick={onContinue}
          disabled={selected === null}
          className="btn-primary"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
