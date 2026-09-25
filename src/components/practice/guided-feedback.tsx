import { CheckRow, Verdict } from "@/components/verdict";
import type { GuidedGradeResult, GuidedStepId } from "@/lib/guided-grading";

const STEP_LABELS: Record<GuidedStepId, string> = {
  bias: "Bias",
  entry: "Entry",
  stop: "Stop",
  target: "Target",
};

export function GuidedFeedback({
  result,
  onNext,
  nextLabel,
}: {
  result: GuidedGradeResult;
  onNext: () => void;
  nextLabel: string;
}) {
  return (
    <div className="card" role="status" aria-live="polite">
      <Verdict correct={result.isCorrect} />

      <ul className="mt-5 space-y-4">
        {result.steps.map((step) => (
          <CheckRow key={step.step} passed={step.isCorrect} label={STEP_LABELS[step.step]}>
            {step.explanation}
          </CheckRow>
        ))}
      </ul>

      {result.achievedRR !== null && (
        <p className="mt-5 text-sm text-foreground">
          Your R:R <span className="font-medium">{result.achievedRR.toFixed(2)}:1</span>{" "}
          <span className="text-muted">(minimum {result.minRR}:1)</span>
        </p>
      )}

      <p className="mt-3 text-sm text-muted">{result.explanation}</p>

      <div className="mt-6 border-t border-line pt-5">
        <button type="button" onClick={onNext} className="btn-primary">
          {nextLabel}
        </button>
      </div>
    </div>
  );
}
