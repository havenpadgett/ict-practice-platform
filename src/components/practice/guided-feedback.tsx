import type { GuidedGradeResult, GuidedStepId } from "@/lib/guided-grading";

const STEP_LABELS: Record<GuidedStepId, string> = {
  bias: "Bias",
  entry: "Entry",
  stop: "Stop",
  target: "Target",
};

const CORRECT_COLOR = "#4caf82";
const INCORRECT_COLOR = "#e2685f";

export function GuidedFeedback({
  result,
  onNext,
  nextLabel,
}: {
  result: GuidedGradeResult;
  onNext: () => void;
  nextLabel: string;
}) {
  const verdictColor = result.isCorrect ? CORRECT_COLOR : INCORRECT_COLOR;

  return (
    <div className="rounded-lg border border-line bg-surface p-4 sm:p-5">
      <p className="text-sm font-semibold uppercase tracking-wide" style={{ color: verdictColor }}>
        {result.isCorrect ? "Correct" : "Not Quite"}
      </p>

      <ul className="mt-3 space-y-3">
        {result.steps.map((step) => (
          <li key={step.step}>
            <p
              className="text-sm font-medium"
              style={{ color: step.isCorrect ? CORRECT_COLOR : INCORRECT_COLOR }}
            >
              {step.isCorrect ? "Correct" : "Incorrect"} — {STEP_LABELS[step.step]}
            </p>
            <p className="mt-0.5 text-sm text-muted">{step.explanation}</p>
          </li>
        ))}
      </ul>

      {result.achievedRR !== null && (
        <p className="mt-3 text-sm text-foreground">
          Your R:R: <span className="font-medium">{result.achievedRR.toFixed(2)}:1</span>{" "}
          <span className="text-muted">(minimum {result.minRR}:1)</span>
        </p>
      )}

      <p className="mt-3 text-sm text-muted">{result.explanation}</p>

      <button
        type="button"
        onClick={onNext}
        className="mt-5 inline-flex min-h-11 items-center justify-center rounded-md bg-accent px-6 py-2.5 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90"
      >
        {nextLabel}
      </button>
    </div>
  );
}
