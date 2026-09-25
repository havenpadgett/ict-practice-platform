import { CheckRow, Verdict } from "@/components/verdict";
import type { FreeTradeGradeResult, FreeTradeOutcome } from "@/lib/free-trade-grading";

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
  const shownChecks = result.checks.filter((c) => c.status !== "na");

  return (
    <div className="card" role="status" aria-live="polite">
      <p className="eyebrow">Process</p>
      <div className="mt-2">
        <Verdict correct={result.passed} label={result.passed ? "Process passed" : "Process failed"} />
      </div>

      <p className="eyebrow mt-5">Outcome</p>
      <p className="mt-1 text-sm text-foreground">
        {OUTCOME_LABELS[result.outcome]}
        {result.resultR !== null && <span className="font-medium"> · {formatR(result.resultR)}</span>}
        {result.rr !== null && <span className="text-muted"> · planned R:R {result.rr.toFixed(2)}:1</span>}
      </p>

      <p className="mt-3 text-sm text-muted">
        You&apos;re graded on process, not outcome. A losing trade with good process passes; a winning trade with bad
        process doesn&apos;t.
      </p>

      <ul className="mt-5 space-y-4">
        {shownChecks.map((check) => (
          <CheckRow key={check.id} passed={check.status === "pass"} label={check.label}>
            {check.reason}
          </CheckRow>
        ))}
      </ul>

      <p className="eyebrow mt-5">{isValidSetup ? "The ideal trade" : "Why not to trade"}</p>
      <p className="mt-1 text-sm text-muted">{result.explanation}</p>

      <div className="mt-6 border-t border-line pt-5">
        <button type="button" onClick={onNext} className="btn-primary">
          {nextLabel}
        </button>
      </div>
    </div>
  );
}
