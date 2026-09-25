import { Verdict } from "@/components/verdict";
import type { GradeResult } from "@/lib/grading";

export function FeedbackPanel({
  result,
  onNext,
  nextLabel,
}: {
  result: GradeResult;
  onNext: () => void;
  nextLabel: string;
}) {
  return (
    <div className="card" role="status" aria-live="polite">
      <Verdict correct={result.isCorrect} />

      {result.failureMessage && <p className="mt-3 text-base text-foreground">{result.failureMessage}</p>}

      <p className="mt-3 text-sm text-muted">{result.explanation}</p>

      <div className="mt-6 border-t border-line pt-5">
        <button type="button" onClick={onNext} className="btn-primary">
          {nextLabel}
        </button>
      </div>
    </div>
  );
}
