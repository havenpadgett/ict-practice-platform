"use client";

import { CheckRow, Verdict } from "@/components/verdict";
import type { GradeResult } from "@/lib/grading";

export function FeedbackPanel({
  result,
  rule,
  onShowWhy,
  onNext,
  nextLabel,
  onRetry,
  isRetry = false,
}: {
  result: GradeResult;
  /** The concept's rule in plain words, for "Show me why". */
  rule?: string;
  /** Called when "Show me why" opens (the chart highlights the setup). */
  onShowWhy?: (open: boolean) => void;
  onNext: () => void;
  nextLabel: string;
  /** Answer the same chart again, without it counting. */
  onRetry?: () => void;
  /** This verdict is for a retry, which isn't recorded. */
  isRetry?: boolean;
}) {
  return (
    <div className="card" role="status" aria-live="polite">
      <Verdict verdict={result.verdict} />
      {isRetry && <p className="mt-1 text-xs text-muted">Retry: not counted in your stats or mistakes.</p>}

      {result.failureMessage && <p className="mt-3 text-base text-foreground">{result.failureMessage}</p>}

      {result.checks && result.checks.length > 0 && (
        <ul className="mt-4 space-y-3">
          {result.checks.map((check) => (
            <CheckRow key={check.id} verdict={check.verdict} label={check.label}>
              {check.detail}
            </CheckRow>
          ))}
        </ul>
      )}

      <p className="mt-4 text-sm text-muted">{result.explanation}</p>

      {rule && (
        <details className="mt-4 border-t border-line pt-3" onToggle={(e) => onShowWhy?.((e.target as HTMLDetailsElement).open)}>
          <summary className="inline-flex min-h-11 cursor-pointer items-center text-sm font-medium text-foreground underline-offset-4 hover:underline">
            Show me exactly why
          </summary>
          <p className="mt-1 text-sm text-muted">{rule}</p>
          {result.revealZone && (
            <p className="mt-2 text-sm text-muted">
              The correct answer is dashed on the chart{onShowWhy ? ", and the candles that form it are shaded" : ""}. Your
              answer is the solid one.
            </p>
          )}
        </details>
      )}

      <div className="mt-5 flex flex-wrap gap-3 border-t border-line pt-5">
        <button type="button" onClick={onNext} className="btn-primary">
          {nextLabel}
        </button>
        {onRetry && (
          <button type="button" onClick={onRetry} className="btn-secondary">
            Retry this chart
          </button>
        )}
      </div>
    </div>
  );
}
