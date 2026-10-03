import { GlossaryText } from "@/components/glossary/glossary-text";
import { useExperience } from "@/contexts/experience-context";
import { behavior } from "@/lib/experience";
import { CheckRow, Verdict } from "@/components/verdict";
import type { GuidedGradeResult, GuidedStepId } from "@/lib/guided-grading";

const STEP_LABELS: Record<GuidedStepId, string> = {
  bias: "Bias",
  entry: "Entry",
  stop: "Stop",
  target: "Target",
};

const OVERALL_LABEL: Record<GuidedGradeResult["verdict"], string> = {
  correct: "Process passed",
  could_improve: "Process passed — could improve",
  incorrect: "Process failed",
};

export function GuidedFeedback({
  result,
  plan,
  onNext,
  nextLabel,
  share,
}: {
  result: GuidedGradeResult;
  /** What the user built, in one line. */
  plan: string;
  onNext: () => void;
  nextLabel: string;
  /** A share action for the chart (src/components/share-button.tsx). */
  share?: React.ReactNode;
}) {
  const { level } = useExperience();
  const full = behavior(level).fullFeedback;
  const quick = behavior(level).quickAdvance;
  return (
    <div className="card" role="status" aria-live="polite">
      <Verdict verdict={result.verdict} label={OVERALL_LABEL[result.verdict]} />
      <p className="mt-2 text-sm text-foreground tabular-nums">
        <span className="text-muted">Your plan: </span>
        {plan}
      </p>

      <p className="eyebrow mt-5">Step by step</p>
      <ul className="mt-3 space-y-4">
        {result.steps.map((step) => (
          <CheckRow key={step.step} verdict={step.verdict} label={STEP_LABELS[step.step]}>
            {/* Experienced: a step that was right is just its verdict. */}
            {full || step.verdict !== "correct" ? step.explanation : undefined}
          </CheckRow>
        ))}
      </ul>

      {result.achievedRR !== null && (
        <p className="mt-5 text-sm text-foreground">
          Your R:R <span className="font-medium">{result.achievedRR.toFixed(2)}:1</span>{" "}
          <span className="text-muted">(minimum {result.minRR}:1)</span>
        </p>
      )}

      {full ? (
        <p className="mt-3 text-sm text-muted">
          <GlossaryText text={result.explanation} />
        </p>
      ) : (
        <details className="mt-3">
          <summary className="inline-flex min-h-11 cursor-pointer items-center text-sm text-muted underline underline-offset-4 hover:text-foreground">
            Explanation
          </summary>
          <p className="text-sm text-muted">
            <GlossaryText text={result.explanation} />
          </p>
        </details>
      )}

      <div className="mt-6 border-t border-line pt-5">
        <button type="button" onClick={onNext} className="btn-primary" autoFocus={quick} aria-keyshortcuts={quick ? "N" : undefined}>
          {nextLabel}
          {quick && <kbd className="ml-1 font-mono text-[11px] opacity-70">N</kbd>}
        </button>
      </div>
      {share && <div className="mt-3">{share}</div>}
    </div>
  );
}
