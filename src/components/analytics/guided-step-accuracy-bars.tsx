import { AccuracyBar } from "@/components/analytics/accuracy-bar";
import type { GuidedStepAccuracy } from "@/lib/analytics";

const STEP_LABELS: Record<GuidedStepAccuracy["step"], string> = {
  bias: "Bias",
  entry: "Entry",
  stop: "Stop",
  target: "Target",
};

export function GuidedStepAccuracyBars({ steps }: { steps: GuidedStepAccuracy[] }) {
  if (steps.length === 0) return null;

  return (
    <div className="space-y-4">
      {steps.map((step) => (
        <AccuracyBar key={step.step} label={STEP_LABELS[step.step]} accuracy={step.accuracy} />
      ))}
    </div>
  );
}
