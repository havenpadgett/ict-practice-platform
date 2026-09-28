import type { GuidedBias } from "@/data/exercises";

const OPTIONS: { value: GuidedBias; label: string }[] = [
  { value: "bullish", label: "Bullish" },
  { value: "bearish", label: "Bearish" },
  { value: "unclear", label: "Unclear" },
];

/** Step 1. "Unclear" is the No Trade answer at this step: with no
 * direction there's nothing to build an entry against, so choosing it
 * submits the attempt as No Trade (there's no separate No Trade button
 * here to duplicate it). A direction with no valid setup is answered by
 * picking the direction, then No Trade at the entry step. */
export function GuidedBiasControls({
  selected,
  onSelect,
  onContinue,
}: {
  selected: GuidedBias | null;
  onSelect: (bias: GuidedBias) => void;
  onContinue: () => void;
}) {
  return (
    <div>
      <p className="text-sm text-muted">Which way does structure point?</p>
      <div className="mt-3 flex flex-wrap gap-3" role="group" aria-label="Bias">
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
      <p className="mt-3 text-xs text-muted">
        Unclear means No Trade. If you can see a direction but no valid setup, pick the direction and choose No Trade
        at the next step.
      </p>
      <div className="mt-5 border-t border-line pt-5">
        <button type="button" onClick={onContinue} disabled={selected === null} className="btn-primary">
          {selected === "unclear" ? "Submit as No Trade" : "Continue to entry"}
        </button>
      </div>
    </div>
  );
}
