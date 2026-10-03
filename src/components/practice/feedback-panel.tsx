"use client";

import { useEffect } from "react";
import { GlossaryText } from "@/components/glossary/glossary-text";
import { useExperience } from "@/contexts/experience-context";
import { behavior } from "@/lib/experience";
import { firstSentence } from "@/lib/first-sentence";
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
  actions,
  share,
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
  /** Replaces the Next / Retry buttons (public challenges send the
   * learner somewhere else than "the next exercise"). */
  actions?: React.ReactNode;
  /** A share action for this chart (src/components/share-button.tsx). */
  share?: React.ReactNode;
}) {
  const { level } = useExperience();
  const full = behavior(level).fullFeedback;
  const quick = behavior(level).quickAdvance;
  // Experienced: the verdict and what was off, with the diagnosis only when
  // something was; the explanation and the rule are one click away. A clean
  // correct answer is the verdict and the way forward.
  // Open from the start for a miss (beginners), so the setup is shaded on the chart.
  const openByDefault = full && !!rule && result.verdict !== "correct";
  useEffect(() => {
    if (openByDefault) onShowWhy?.(true);
    // Once, when the feedback appears.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const showChecks = !!result.checks && result.checks.length > 0 && (full || result.verdict !== "correct");
  return (
    <div className="card" role="status" aria-live="polite">
      <Verdict verdict={result.verdict} />
      {isRetry && <p className="mt-1 text-xs text-muted">Retry: not counted in your stats or mistakes.</p>}

      {result.failureMessage && (
        <p className="mt-3 text-base text-foreground">
          <GlossaryText text={result.failureMessage} />
        </p>
      )}

      {/* Experienced, and nothing measured to show: say what was off in one line. */}
      {!full && result.verdict !== "correct" && !result.failureMessage && !showChecks && (
        <p className="mt-3 text-base text-foreground">
          <GlossaryText text={firstSentence(result.explanation)} />
        </p>
      )}

      {showChecks && result.checks && (
        <ul className="mt-4 space-y-3">
          {result.checks.map((check) => (
            <CheckRow key={check.id} verdict={check.verdict} label={check.label}>
              {check.detail}
            </CheckRow>
          ))}
        </ul>
      )}

      {full ? (
        <>
          <p className="mt-4 text-sm text-muted">
            <GlossaryText text={result.explanation} />
          </p>

          {rule && (
            <details
              className="mt-4 border-t border-line pt-3"
              open={openByDefault}
              onToggle={(e) => onShowWhy?.((e.target as HTMLDetailsElement).open)}
            >
              <summary className="inline-flex min-h-11 cursor-pointer items-center text-sm font-medium text-foreground underline-offset-4 hover:underline">
                Show me exactly why
              </summary>
              <p className="mt-1 text-sm text-muted">
                <GlossaryText text={rule} />
              </p>
              {result.revealZone && (
                <p className="mt-2 text-sm text-muted">
                  The correct answer is dashed on the chart{onShowWhy ? ", and the candles that form it are shaded" : ""}. Your
                  answer is the solid one.
                </p>
              )}
            </details>
          )}
        </>
      ) : (
        <details className="mt-3" onToggle={(e) => onShowWhy?.((e.target as HTMLDetailsElement).open)}>
          <summary className="inline-flex min-h-11 cursor-pointer items-center text-sm text-muted underline underline-offset-4 hover:text-foreground">
            Explanation
          </summary>
          <p className="text-sm text-muted">
            <GlossaryText text={result.explanation} />
          </p>
          {rule && (
            <p className="mt-2 text-sm text-muted">
              <GlossaryText text={rule} />
            </p>
          )}
        </details>
      )}

      <div className="mt-5 flex flex-wrap gap-3 border-t border-line pt-5">
        {actions ?? (
          <>
            <button type="button" onClick={onNext} className="btn-primary" autoFocus={quick} aria-keyshortcuts={quick ? "N" : undefined}>
              {nextLabel}
              {quick && <kbd className="ml-1 font-mono text-[11px] opacity-70">N</kbd>}
            </button>
            {onRetry && (
              <button type="button" onClick={onRetry} className="btn-secondary">
                Retry this chart
              </button>
            )}
          </>
        )}
      </div>
      {share && <div className="mt-3">{share}</div>}
    </div>
  );
}
