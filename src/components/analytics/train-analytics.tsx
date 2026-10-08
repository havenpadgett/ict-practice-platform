"use client";

import Link from "next/link";
import { MetricStrip } from "@/components/metric-strip";
import { useTraining } from "@/hooks/use-training";
import { KnowledgeVsApplication } from "@/components/train/knowledge-vs-application";
import { MIN_SAMPLES } from "@/lib/engine/history";
import { buildPerformance, type Slice } from "@/lib/engine/performance";
import { MISTAKE_LABEL } from "@/lib/engine/review";
import { SCENARIO_CATALOG } from "@/lib/engine/store";

const pct = (x: number) => `${Math.round(x * 100)}%`;

/** One row per slice: average process score, correct rate where there are
 * enough attempts, and always the sample size. */
function SliceList({ rows, label }: { rows: Slice[]; label: string }) {
  if (rows.length === 0) return null;
  return (
    <ul className="divide-y divide-line border-y border-line" aria-label={label}>
      {rows.map((r) => (
        <li key={r.key} className="grid grid-cols-[1fr_auto] items-center gap-3 py-2 text-sm sm:grid-cols-[12rem_1fr_auto]">
          <span className="text-foreground">{r.label}</span>
          <span className="hidden h-1.5 overflow-hidden rounded-full bg-line sm:block" aria-hidden>
            {r.avgScore !== null && r.n >= MIN_SAMPLES ? <span className="block h-full bg-muted" style={{ width: `${Math.round(r.avgScore)}%` }} /> : null}
          </span>
          <span className="text-right text-xs tabular-nums">
            {r.n >= MIN_SAMPLES && r.avgScore !== null ? `${Math.round(r.avgScore)} avg${r.correctRate !== null ? ` · ${pct(r.correctRate)} strong` : ""} · ${r.n} attempts` : `${r.n} attempt${r.n === 1 ? "" : "s"}, too few`}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Simulation and training figures: process score, confidence against
 * process on the 1-5 scale, Correct Avoidance Rate, and the structured
 * mistakes. Nothing here uses the trade's result in R as a measure of skill. */
export function TrainAnalytics() {
  const t = useTraining();
  if (t.loading || !t.summary || t.summary.total === 0) return null;
  const s = t.summary;
  const { calibration: c, avoidance: a } = s;
  const perf = buildPerformance(t.attempts ?? [], SCENARIO_CATALOG);
  const shownMetrics = perf.metrics.filter((m) => m.n > 0);

  return (
    <section aria-labelledby="an-train" className="border-t border-line pt-8">
      <h2 id="an-train" className="text-lg">
        Simulation and training
      </h2>
      <p className="mt-1 text-sm text-muted">Scenarios scored on process. The result in R is shown beside it and never feeds it.</p>
      <div className="mt-5 space-y-8">
        {perf.insights.length > 0 && (
          <ul className="max-w-3xl space-y-1.5 text-lg leading-snug text-foreground" aria-label="What your training data says">
            {perf.insights.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
        )}

        {t.vector && <KnowledgeVsApplication vector={t.vector} />}

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

        {shownMetrics.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-foreground">Accuracy by part of the process</h3>
            <p className="mt-1 text-xs text-muted">Share of attempts where that part scored 80 or more. A percentage appears after {MIN_SAMPLES} attempts.</p>
            <ul className="mt-3 divide-y divide-line border-y border-line">
              {shownMetrics.map((m) => (
                <li key={m.id} className="grid grid-cols-[1fr_auto] items-center gap-3 py-2 text-sm sm:grid-cols-[12rem_1fr_auto]">
                  <span className="text-foreground">{m.label}</span>
                  <span className="hidden h-1.5 overflow-hidden rounded-full bg-line sm:block" aria-hidden>
                    {m.correctRate !== null ? <span className="block h-full bg-muted" style={{ width: `${Math.round(m.correctRate * 100)}%` }} /> : null}
                  </span>
                  <span className="text-right text-xs tabular-nums">
                    {m.correctRate !== null ? `${pct(m.correctRate)} · ${m.n} attempts` : `${m.n} attempt${m.n === 1 ? "" : "s"}, too few`}
                    {m.avgConfidence !== null && m.ratedN >= MIN_SAMPLES ? ` · confidence ${m.avgConfidence.toFixed(1)}/5` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {perf.falsePositive.rate !== null && (
          <p className="max-w-2xl text-sm">
            False-positive rate: <span className="text-foreground tabular-nums">{pct(perf.falsePositive.rate)}</span> ({perf.falsePositive.wrong} of {perf.falsePositive.trades} trades taken were on a chart with no defensible trade, or a decision that didn&apos;t hold up).
          </p>
        )}

        {perf.bySetup.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-foreground">By setup</h3>
            <div className="mt-2">
              <SliceList rows={perf.bySetup} label="Process score by setup" />
            </div>
          </div>
        )}
        {perf.bySession.length > 1 && (
          <div>
            <h3 className="text-sm font-medium text-foreground">By session</h3>
            <p className="mt-1 text-xs text-muted">The session of the decision moment on the chart.</p>
            <div className="mt-2">
              <SliceList rows={perf.bySession} label="Process score by session" />
            </div>
          </div>
        )}
        {perf.byTimeframe.length > 1 && (
          <div>
            <h3 className="text-sm font-medium text-foreground">By timeframe</h3>
            <p className="mt-1 text-xs text-muted">The timeframe you did most of your marking on. Attempts with no marks aren&apos;t counted.</p>
            <div className="mt-2">
              <SliceList rows={perf.byTimeframe} label="Process score by timeframe" />
            </div>
          </div>
        )}
        {perf.byDifficulty.length > 1 && (
          <div>
            <h3 className="text-sm font-medium text-foreground">By difficulty</h3>
            <div className="mt-2">
              <SliceList rows={perf.byDifficulty} label="Process score by difficulty" />
            </div>
          </div>
        )}
        {perf.overTime.length >= 2 && (
          <div>
            <h3 className="text-sm font-medium text-foreground">Process score over time</h3>
            <p className="mt-1 text-xs text-muted">Average of each block of five scenarios, oldest first.</p>
            <p className="mt-2 text-sm tabular-nums text-foreground">{perf.overTime.map((p) => Math.round(p.avgScore)).join(" → ")}</p>
          </div>
        )}

        {s.mistakes.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-foreground">Mistakes by frequency</h3>
            <p className="mt-1 text-xs text-muted">Out of {perf.total} scenarios.</p>
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
