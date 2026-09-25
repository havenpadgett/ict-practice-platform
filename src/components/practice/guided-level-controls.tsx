import type { GuidedLevelField } from "@/components/practice/candlestick-chart";

const STEP_COPY: Record<GuidedLevelField, string> = {
  entry: "Place your entry — click the level on the chart.",
  stop: "Place your stop — click the level on the chart.",
  target: "Place your target — click the level on the chart.",
};

export function GuidedLevelControls({
  step,
  price,
  onContinue,
  onNoTrade,
  liveRR,
  minRR,
}: {
  step: GuidedLevelField;
  price: number | null;
  onContinue: () => void;
  onNoTrade: () => void;
  /** Only meaningful (and shown) on the "target" step, once entry/stop/target
   * are all placed — computed from the user's own levels, live, as they drag. */
  liveRR: number | null;
  minRR: number;
}) {
  const continueLabel = step === "target" ? "Submit Setup" : "Continue";

  return (
    <div>
      <p className="text-sm text-muted">{STEP_COPY[step]}</p>

      {step === "target" && liveRR !== null && (
        <p className="mt-2 text-sm text-foreground">
          Live R:R:{" "}
          <span className={liveRR >= minRR ? "text-accent font-medium" : "font-medium"}>
            {liveRR.toFixed(2)}:1
          </span>
          <span className="text-muted"> (minimum {minRR}:1)</span>
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onContinue}
          disabled={price === null}
          className="btn-primary"
        >
          {continueLabel}
        </button>
        <button
          type="button"
          onClick={onNoTrade}
          className="btn-secondary"
        >
          No Trade
        </button>
      </div>
    </div>
  );
}
