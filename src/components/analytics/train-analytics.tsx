"use client";

import Link from "next/link";
import { MetricStrip } from "@/components/metric-strip";
import { useTraining } from "@/hooks/use-training";
import { MIN_SAMPLES } from "@/lib/engine/history";
import { MISTAKE_LABEL } from "@/lib/engine/review";

/** Simulation and training figures: process score, confidence against
 * process on the 1-5 scale, Correct Avoidance Rate, and the structured
 * mistakes. Nothing here uses the trade's result in R as a measure of skill. */
export function TrainAnalytics() {
  const t = useTraining();
  if (t.loading || !t.summary || t.summary.total === 0) return null;
  const s = t.summary;
  const { calibration: c, avoidance: a } = s;

  return (
    <section aria-labelledby="an-train" className="border-t border-line pt-8">
      <h2 id="an-train" className="text-lg">
        Simulation and training
      </h2>
      <p className="mt-1 text-sm text-muted">Scenarios scored on process. The result in R is shown beside it and never feeds it.</p>
      <div className="mt-5 space-y-8">
        <MetricStrip
          metrics={[
            { label: "Scenarios", value: String(s.total), detail: "finished" },
            { label: "Process score", value: s.avgScore === null ? "—" : String(Math.round(s.avgScore)), detail: s.recentAvgScore === null ? "average" : `last 10: ${Math.round(s.recentAvgScore)}` },
            {
              label: "Correct avoidance",
              value: a.rate === null ? "—" : `${Math.round(a.rate * 100)}%`,
              detail: a.rate === null ? `needs ${MIN_SAMPLES} no-trade charts (${a.noTradeAttempts} so far)` : `${a.avoided} of ${a.noTradeAttempts} no-trade charts`,
            },
            { label: "Skipped valid setups", value: a.skipRate === null ? "—" : `${Math.round(a.skipRate * 100)}%`, detail: a.skipRate === null ? `needs ${MIN_SAMPLES} setups` : `${a.skippedValid} of ${a.validAttempts}` },
          ]}
        />

        {(s.goodProcessLosses > 0 || s.badProcessWins > 0) && (
          <p className="max-w-2xl text-sm">
            {s.goodProcessLosses > 0 && <>{s.goodProcessLosses} trade{s.goodProcessLosses === 1 ? "" : "s"} scored 80 or more and lost: normal failed setups. </>}
            {s.badProcessWins > 0 && <>{s.badProcessWins} scored under 60 and won: that&apos;s luck, not skill, and it&apos;s the one to be wary of.</>}
          </p>
        )}

        <div>
          <h3 className="text-sm font-medium text-foreground">Confidence (1 to 5) against process score</h3>
          {c.rated === 0 ? (
            <p className="mt-1 text-sm">No confidence ratings yet. The simulator and the training modes ask for one at submission.</p>
          ) : (
            <>
              {c.insight && <p className="mt-1 max-w-2xl text-sm text-foreground">{c.insight}</p>}
              <ul className="mt-3 divide-y divide-line border-y border-line" aria-label="Average process score by confidence">
                {c.levels.map((l) => (
                  <li key={l.confidence} className="grid grid-cols-[6rem_1fr_auto] items-center gap-3 py-2 text-sm">
                    <span className="text-foreground">Confidence {l.confidence}</span>
                    <span className="h-1.5 overflow-hidden rounded-full bg-line" aria-hidden>
                      {l.avgScore !== null && l.attempts >= MIN_SAMPLES ? <span className="block h-full bg-muted" style={{ width: `${Math.round(l.avgScore)}%` }} /> : null}
                    </span>
                    <span className="text-right text-xs tabular-nums">{l.attempts >= MIN_SAMPLES && l.avgScore !== null ? `${Math.round(l.avgScore)} · ${l.attempts} attempts` : `${l.attempts} attempt${l.attempts === 1 ? "" : "s"}, too few`}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs tabular-nums">
                High confidence, low score: {c.highConfidenceLowScore}. Low confidence, high score: {c.lowConfidenceHighScore}.
              </p>
            </>
          )}
        </div>

        {s.mistakes.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-foreground">Mistakes by frequency</h3>
            <ul className="mt-2 space-y-1 text-sm">
              {s.mistakes.slice(0, 4).map((m) => (
                <li key={m.id}>
                  <span className="text-foreground">{MISTAKE_LABEL[m.id]}</span> <span className="tabular-nums">· {m.count}</span>
                </li>
              ))}
            </ul>
            <Link href="/train/journal?tab=mistakes" className="btn-link mt-1 inline-flex">
              Mistake library
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
