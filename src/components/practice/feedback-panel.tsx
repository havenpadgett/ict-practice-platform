import type { GradeResult } from "@/lib/grading";

export function FeedbackPanel({
  result,
  onTryAgain,
}: {
  result: GradeResult;
  onTryAgain: () => void;
}) {
  const verdictColor = result.isCorrect ? "#4caf82" : "#e2685f";

  return (
    <div className="rounded-lg border border-line bg-surface p-4 sm:p-5">
      <p
        className="text-sm font-semibold uppercase tracking-wide"
        style={{ color: verdictColor }}
      >
        {result.isCorrect ? "Correct" : "Not Quite"}
      </p>

      {result.failureMessage && (
        <p className="mt-2 text-sm text-foreground/90">{result.failureMessage}</p>
      )}

      <p className="mt-2 text-sm text-muted">{result.explanation}</p>

      <button
        type="button"
        onClick={onTryAgain}
        className="mt-5 inline-flex items-center justify-center rounded-md border border-line px-6 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-background"
      >
        Try Again
      </button>
    </div>
  );
}
