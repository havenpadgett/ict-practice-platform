import type { GuidedLevelField } from "@/components/practice/candlestick-chart";
import { ManualEntry } from "@/components/practice/manual-entry";

const STEP_COPY: Record<GuidedLevelField, string> = {
  entry: "Click or tap the chart at your entry price. Drag to adjust.",
  stop: "Now your stop: where the idea is wrong.",
  target: "Now your target: where you'd take profit.",
};

const NEXT_LABEL: Record<GuidedLevelField, string> = {
  entry: "Continue to stop",
  stop: "Continue to target",
  target: "Submit setup",
};

export function GuidedLevelControls({
  step,
  price,
  onContinue,
  onBack,
  onNoTrade,
  liveRR,
  minRR,
  guidance,
  onManualPrice,
}: {
  step: GuidedLevelField;
  /** Sets this step's level from a typed price (keyboard alternative). */
  onManualPrice: (price: number) => void;
  price: number | null;
  onContinue: () => void;
  onBack: () => void;
  onNoTrade: () => void;
  /** Only meaningful (and shown) on the "target" step, once entry/stop/target
   * are all placed — computed from the user's own levels, live, as they drag. */
  liveRR: number | null;
  minRR: number;
  /** Beginner-only hints (risk distance, the 2R level). */
  guidance?: string | null;
}) {
  return (
    <div>
      <p className="text-sm text-muted">{STEP_COPY[step]}</p>
      {guidance && <p className="mt-2 text-sm text-foreground">{guidance}</p>}

      {step === "target" && liveRR !== null && (
        <p className="mt-2 text-sm text-foreground tabular-nums">
          R:R <span className="font-medium">{liveRR.toFixed(2)}:1</span>
          <span className="text-muted">
            {" "}
            · {liveRR >= minRR ? "meets" : "below"} the {minRR}:1 minimum
          </span>
        </p>
      )}

      <ManualEntry key={step} kind="level" candleCount={0} onLevel={onManualPrice} label={`Price of your ${step}`} />

      <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-line pt-5">
        <button type="button" onClick={onContinue} disabled={price === null} className="btn-primary">
          {NEXT_LABEL[step]}
        </button>
        <button type="button" onClick={onNoTrade} className="btn-secondary">
          No Trade
        </button>
        <button type="button" onClick={onBack} className="btn-link">
          Back
        </button>
      </div>
    </div>
  );
}
