import type { FreeTradeGradeResult, FreeTradeOutcome } from "@/lib/free-trade-grading";

const CORRECT_COLOR = "#4caf82";
const INCORRECT_COLOR = "#e2685f";

const OUTCOME_LABELS: Record<FreeTradeOutcome, string> = {
  win: "Win — target hit",
  loss: "Loss — stop hit",
  open: "Still open at session end",
  no_trade: "No trade",
};

function formatR(r: number): string {
  const sign = r > 0 ? "+" : r < 0 ? "−" : "";
  return `${sign}${Math.abs(r).toFixed(2)}R`;
}

export function FreeTradeFeedback({
  result,
  isValidSetup,
  onNext,
  nextLabel,
}: {
  result: FreeTradeGradeResult;
  isValidSetup: boolean;
  onNext: () => void;
  nextLabel: string;
}) {
  const verdictColor = result.passed ? CORRECT_COLOR : INCORRECT_COLOR;
  const shownChecks = result.checks.filter((c) => c.status !== "na");

  return (
    <div className="rounded-lg border border-line bg-surface p-4 sm:p-5">
      <p className="eyebrow">Process</p>
      <p className="mt-1 text-sm font-semibold uppercase tracking-wide" style={{ color: verdictColor }}>
        {result.passed ? "Pass" : "Fail"}
      </p>

      <p className="eyebrow mt-4">Outcome</p>
      <p className="mt-1 text-sm text-foreground">
        {OUTCOME_LABELS[result.outcome]}
        {result.resultR !== null && <span className="font-medium"> · {formatR(result.resultR)}</span>}
        {result.rr !== null && <span className="text-muted"> · planned R:R {result.rr.toFixed(2)}:1</span>}
      </p>

      <p className="mt-3 text-sm text-muted">
        You&apos;re graded on process, not outcome. A losing trade with good process passes; a winning trade with bad
        process doesn&apos;t.
      </p>

      <ul className="mt-4 space-y-3">
        {shownChecks.map((check) => (
          <li key={check.id}>
            <p
              className="text-sm font-medium"
              style={{ color: check.status === "pass" ? CORRECT_COLOR : INCORRECT_COLOR }}
            >
              {check.status === "pass" ? "Pass" : "Fail"} — {check.label}
            </p>
            <p className="mt-0.5 text-sm text-muted">{check.reason}</p>
          </li>
        ))}
      </ul>

      <p className="eyebrow mt-5">{isValidSetup ? "The ideal trade" : "Why not to trade"}</p>
      <p className="mt-1 text-sm text-muted">{result.explanation}</p>

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
