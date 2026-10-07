"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ROLE_STYLE, ScenarioChart } from "@/components/sim/scenario-chart";
import type { ChartTrade, Plan } from "@/components/sim/chart-types";
import { Verdict, VerdictInline } from "@/components/verdict";
import { defensibleValues } from "@/lib/engine/accept";
import { fromRow, seriesAt, supportedTimeframes, type TimeframeData } from "@/lib/engine/candles";
import { KIND_DEFINITION, type ExplanationTier } from "@/lib/engine/kind-definitions";
import { MISTAKE_LABEL, MISTAKE_TIP } from "@/lib/engine/review";
import { fmtPrice } from "@/lib/engine/scoring";
import { TIMEFRAME_LABEL, type Timeframe } from "@/lib/engine/time";
import { describeOutcome } from "@/lib/engine/trade";
import { DIMENSION_LABEL, type Annotation, type AnnotationKind, type AttemptResponse, type AttemptResult, type Order, type RefAnnotation, type Scenario } from "@/lib/engine/types";

const noop = () => {};

function userMarks(response: AttemptResponse): Annotation[] {
  const out: Annotation[] = [];
  for (const r of Object.values(response.stages)) if (r.kind === "mark" || r.kind === "replay") out.push(...r.annotations);
  return out;
}

function userOrder(response: AttemptResponse): { order: Order; decision: string } | null {
  for (const r of Object.values(response.stages)) if ((r.kind === "trade" || r.kind === "replay") && r.order) return { order: r.order, decision: r.decision };
  return null;
}

function userChoice(response: AttemptResponse, ...keys: string[]): string | null {
  for (const k of keys) {
    const r = response.stages[k];
    if (r?.kind === "choice") return r.value;
    if (r?.kind === "replay" && k === "replay") return r.bias;
  }
  const replay = Object.values(response.stages).find((r) => r.kind === "replay");
  return replay && replay.kind === "replay" ? replay.bias : null;
}

/** The reference's trade areas as marks the chart can draw. */
function referenceTradeMarks(scenario: Scenario): RefAnnotation[] {
  const t = scenario.reference.trade;
  if (!t) return [];
  const marks: RefAnnotation[] = [];
  t.entry.forEach((e, i) => marks.push({ id: `ref-entry-${i}`, kind: "zone", role: "valid", label: `Entry area: ${e.label}`, priceLow: e.low, priceHigh: e.high, why: "" }));
  marks.push({ id: "ref-stop", kind: "liquidity", role: "invalidating", label: `Invalidation ${fmtPrice(t.stop.invalidation)}`, price: t.stop.invalidation, why: "" });
  t.targets.forEach((x, i) => marks.push({ id: `ref-target-${i}`, kind: "zone", role: "supporting", label: `Target: ${x.label}`, priceLow: x.low, priceHigh: x.high, why: "" }));
  return marks;
}

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[7rem_1fr] gap-3 py-2 text-sm">
      <dt className="text-xs text-muted">{k}</dt>
      <dd className="min-w-0 text-foreground">{children}</dd>
    </div>
  );
}

function Bucket({ title, items, tone }: { title: string; items: string[]; tone?: "warn" }) {
  if (items.length === 0) return null;
  return (
    <section>
      <h3 className={`eyebrow ${tone === "warn" ? "text-warn" : ""}`}>{title}</h3>
      <ul className="mt-2 space-y-2 text-sm">
        {items.map((item, i) => (
          <li key={i} className="border-l-2 border-line pl-3">
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The post-simulation review: your markings beside the reference, your bias
 * and levels against what was acceptable, what price did next, the process
 * breakdown, and feedback in five buckets. Never says the reference is the
 * only reading: it is one defensible one, and where several were valid it
 * says so. */
export function ReviewView({
  scenario,
  result,
  response,
  tier,
  actions,
}: {
  scenario: Scenario;
  result: AttemptResult;
  response: AttemptResponse;
  tier: ExplanationTier;
  actions: React.ReactNode;
}) {
  const stream = useMemo(() => scenario.data.stream.map(fromRow), [scenario]);
  const data: TimeframeData = useMemo(
    () => ({
      history: Object.fromEntries(Object.entries(scenario.data.history).map(([k, v]) => [k, (v ?? []).map(fromRow)])),
      stream,
      streamTimeframe: scenario.data.streamTimeframe,
    }),
    [scenario, stream],
  );
  const timeframes = useMemo(() => supportedTimeframes(data, stream.length), [data, stream.length]);
  const [tf, setTf] = useState<Timeframe>(timeframes.includes("5m") ? "5m" : timeframes[0]);
  const series = useMemo(() => seriesAt(data, tf, stream.length), [data, tf, stream.length]);

  const marks = useMemo(() => userMarks(response), [response]);
  const placed = useMemo(() => userOrder(response), [response]);
  const ref = scenario.reference;
  const refMarks = useMemo(() => [...ref.annotations, ...referenceTradeMarks(scenario)], [ref.annotations, scenario]);

  const outcome = result.outcome;
  const chartTrade: ChartTrade | null =
    outcome.status === "closed" && placed
      ? { direction: placed.order.direction, fillT: stream[outcome.fillIndex].t, fillPrice: outcome.fillPrice, exitT: stream[outcome.exitIndex].t, exitPrice: outcome.exitPrice, stop: placed.order.stop, target: placed.order.target }
      : null;
  const plan: Plan | null = placed && !chartTrade ? { direction: placed.order.direction, entry: placed.order.entry, stop: placed.order.stop, target: placed.order.target } : null;
  const decisionT = stream[Math.max(0, Math.min(stream.length - 1, (placed?.order.placedAt ?? scenario.cursorStart) - 1))]?.t ?? null;

  const extra = useMemo(() => {
    const prices: number[] = [];
    for (const r of refMarks) {
      if (r.price !== undefined) prices.push(r.price);
      if (r.priceLow !== undefined) prices.push(r.priceLow);
      if (r.priceHigh !== undefined) prices.push(r.priceHigh);
    }
    return prices;
  }, [refMarks]);

  const userBias = userChoice(response, "bias", "replay");
  const yourDecision = placed?.decision ?? Object.values(response.stages).map((r) => (r.kind === "replay" || r.kind === "trade" ? r.decision : r.kind === "choice" && ["long", "short", "wait", "no_trade", "take", "skip"].includes(r.value) ? r.value : null)).find(Boolean) ?? null;
  const t = ref.trade;
  const entryUsed = outcome.status === "closed" ? outcome.fillPrice : placed?.order.entry ?? null;

  const definitions = tier === "define" ? [...new Set(refMarks.map((r) => r.kind))].map((k) => KIND_DEFINITION[k as AnnotationKind]).filter(Boolean) : [];
  const decisionNotes = tier === "decide" ? ref.annotations.filter((a) => a.decisionNote && (a.role === "key" || a.role === "valid")) : [];

  return (
    <div className="space-y-8">
      <header className="grid gap-4 sm:grid-cols-[auto_1fr] sm:items-end">
        <div>
          <p className="eyebrow">Process score</p>
          <p className="mt-1 text-5xl font-semibold tabular-nums tracking-tight text-foreground">{result.score}</p>
        </div>
        <div className="space-y-2">
          <Verdict verdict={result.verdict} />
          <p className="text-sm">
            <span className="text-foreground">{describeOutcome(outcome)}.</span> The score is about how you read and executed it; the result in R is reported beside it and never enters it.
          </p>
          {outcome.status === "closed" && (
            <p className="text-xs tabular-nums">
              Planned {outcome.plannedRR.toFixed(1)}R · worst point against you {outcome.maeR.toFixed(2)}R · best point for you {outcome.mfeR.toFixed(2)}R · {outcome.bars} candles in the trade · checked at {TIMEFRAME_LABEL[outcome.granularity]} candles
            </p>
          )}
          {result.noTradeScenario && (
            <p className="text-sm text-foreground">{result.correctAvoidance ? "Correct avoidance: there was nothing worth taking and you didn't take it." : "There was nothing worth taking here, and you took something."}</p>
          )}
          {!result.noTradeScenario && result.correctAvoidance === null && yourDecision === "no_trade" && <p className="text-sm">A valid setup was available. Passing on it is a decision with a cost, and it&apos;s scored as one.</p>}
        </div>
      </header>

      <section aria-labelledby="charts">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="charts" className="eyebrow">
            Your markings and the reference
          </h2>
          <div role="group" aria-label="Review timeframe" className="flex flex-wrap gap-1">
            {timeframes.map((x) => (
              <button key={x} type="button" aria-pressed={tf === x} onClick={() => setTf(x)} className="btn-option min-h-11 px-3 text-xs">
                {TIMEFRAME_LABEL[x]}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-3 grid gap-4 lg:grid-cols-2">
          <figure className="min-w-0">
            <figcaption className="mb-1 text-xs text-muted">What you did (solid)</figcaption>
            <div className="overflow-hidden rounded-lg border border-line bg-surface p-2">
              <ScenarioChart
                series={series}
                tf={tf}
                tool="cursor"
                interactive={false}
                annotations={marks}
                selectedId={null}
                onSelect={noop}
                onCreate={noop}
                onNote={noop}
                plan={plan}
                planEditable={false}
                planT={decisionT}
                onPlanChange={noop}
                trade={chartTrade}
                defaultBars={100}
                momentT={decisionT}
                momentLabel="YOU DECIDED"
                futureSlots={3}
                label="Your markings and trade on the completed chart"
              />
            </div>
          </figure>
          <figure className="min-w-0">
            <figcaption className="mb-1 text-xs text-muted">One defensible reading (dashed). Alternatives are labelled &ldquo;also valid&rdquo;.</figcaption>
            <div className="overflow-hidden rounded-lg border border-line bg-surface p-2">
              <ScenarioChart
                series={series}
                tf={tf}
                tool="cursor"
                interactive={false}
                annotations={[]}
                selectedId={null}
                onSelect={noop}
                onCreate={noop}
                onNote={noop}
                plan={null}
                planEditable={false}
                planT={null}
                onPlanChange={noop}
                refs={refMarks}
                refLabels="numbered"
                defaultBars={100}
                extraPrices={extra}
                momentT={decisionT}
                momentLabel="DECISION"
                futureSlots={3}
                label="Reference markings on the completed chart"
              />
            </div>
            <ol className="mt-2 grid gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
              {refMarks.map((r, i) => (
                <li key={r.id} className="flex gap-2">
                  <span className="w-4 shrink-0 text-right tabular-nums text-foreground">{i + 1}</span>
                  <span>
                    <span className="text-foreground">{ROLE_STYLE[r.role].tag.toLowerCase()}</span> · {r.label}
                  </span>
                </li>
              ))}
            </ol>
          </figure>
        </div>
      </section>

      <section aria-labelledby="compare">
        <h2 id="compare" className="eyebrow">
          You against the reference
        </h2>
        <dl className="mt-2 divide-y divide-line rounded-lg border border-line bg-surface px-4">
          <Row k="Bias">
            {userBias ?? "none declared"} <span className="text-muted">· defensible: {defensibleValues(ref.bias).join(", ")} on the {TIMEFRAME_LABEL[ref.biasTimeframe]}</span>
          </Row>
          <Row k="Decision">
            {String(yourDecision ?? "none").replace("_", " ")} <span className="text-muted">· defensible: {defensibleValues(ref.decision).map((d) => d.replace("_", " ")).join(", ")}</span>
          </Row>
          {result.marks && (
            <Row k="Markings">
              {result.marks.matched.filter((m) => m.ref.role !== "invalidating").length} on structure that mattered
              {result.marks.missed.length > 0 && <span className="text-muted"> · missed {result.marks.missed.map((m) => m.label).join("; ")}</span>}
              {result.marks.unmatched.length > 0 && <span className="text-muted"> · {result.marks.unmatched.length} on nothing in particular</span>}
            </Row>
          )}
          {t && placed && (
            <>
              <Row k="Entry">
                {entryUsed !== null ? fmtPrice(entryUsed) : "at market"} <span className="text-muted">· acceptable: {t.entry.map((e) => `${e.label} ${fmtPrice(e.low)}–${fmtPrice(e.high)}`).join(" or ")}</span>
              </Row>
              <Row k="Stop">
                {fmtPrice(placed.order.stop)} <span className="text-muted">· proven wrong beyond {fmtPrice(t.stop.invalidation)}</span>
              </Row>
              <Row k="Target">
                {fmtPrice(placed.order.target)} <span className="text-muted">· acceptable: {t.targets.map((x) => `${x.label} ${fmtPrice(x.low)}–${fmtPrice(x.high)}`).join(" or ")}</span>
              </Row>
            </>
          )}
          <Row k="What price did">{outcomeStory(result, stream.length)}</Row>
        </dl>
      </section>

      <section aria-labelledby="breakdown">
        <h2 id="breakdown" className="eyebrow">
          Process breakdown
        </h2>
        <ul className="mt-2 divide-y divide-line rounded-lg border border-line bg-surface">
          {result.dimensions
            .filter((d) => d.applicable)
            .map((d) => (
              <li key={d.dimension} className="px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-foreground">{DIMENSION_LABEL[d.dimension]}</p>
                  <p className="flex items-center gap-2 text-sm tabular-nums text-foreground">
                    <VerdictInline verdict={d.verdict} />
                    {d.score}
                  </p>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line" aria-hidden>
                  <div className="h-full bg-foreground/70" style={{ width: `${d.score}%` }} />
                </div>
                <p className="mt-2 text-xs leading-relaxed">{d.note}</p>
              </li>
            ))}
        </ul>
        {result.caps.length > 0 && <p className="mt-2 text-sm text-warn">{result.caps.join(" ")}</p>}
      </section>

      {result.mistakes.length > 0 && (
        <section aria-labelledby="mistakes">
          <h2 id="mistakes" className="eyebrow">
            Mistakes this attempt
          </h2>
          <ul className="mt-2 space-y-2">
            {result.mistakes.map((m) => (
              <li key={m} className="rounded-lg border border-line bg-surface px-4 py-3 text-sm">
                <p className="font-medium text-foreground">{MISTAKE_LABEL[m]}</p>
                <p className="text-xs">{MISTAKE_TIP[m]}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-6" aria-label="Feedback">
        <p className="text-sm text-foreground">{ref.summary}</p>
        <Bucket title="What you read correctly" items={result.review.readCorrectly} />
        <Bucket title="What you missed" items={result.review.missed} />
        <Bucket title="On the chart, but it didn't matter" items={result.review.presentButIrrelevant} />
        <Bucket title="What weakened or invalidated the setup" items={result.review.weakenedSetup} tone="warn" />
        {decisionNotes.length > 0 && (
          <section>
            <h3 className="eyebrow">What it changes in the decision</h3>
            <ul className="mt-2 space-y-2 text-sm">
              {decisionNotes.map((a) => (
                <li key={a.id} className="border-l-2 border-line pl-3">
                  <span className="text-foreground">{a.label}.</span> {a.decisionNote}
                </li>
              ))}
            </ul>
          </section>
        )}
        <Bucket title="What to look for next time" items={result.review.lookForNextTime} />
        {definitions.length > 0 && (
          <section>
            <h3 className="eyebrow">Terms on this chart</h3>
            <ul className="mt-2 space-y-1 text-sm">
              {definitions.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          </section>
        )}
      </section>

      {result.confidence !== null && (
        <p className="text-sm">
          You rated this {result.confidence} of 5 for confidence. Process score {result.score}. Calibration builds across attempts: it&apos;s on your <Link href="/dashboard" className="text-accent underline underline-offset-2">dashboard</Link> once there are enough.
        </p>
      )}

      <p className="text-xs">
        {scenario.provenance.kind === "seeded" ? "Seeded scenario: a constructed price path, not market history." : "Built from market data."} This is one defensible reading, not the only one.
      </p>

      <div className="flex flex-wrap gap-3 border-t border-line pt-6">{actions}</div>
    </div>
  );
}

function outcomeStory(result: AttemptResult, total: number): string {
  const o = result.outcome;
  if (o.status === "closed") {
    const how = o.exit === "stop" ? "price reached your stop" : o.exit === "target" ? "price reached your target" : "the data ended with the trade still open";
    return `Filled ${o.bars} candles before it ended: ${how}. ${o.resultR >= 0 ? "+" : "−"}${Math.abs(o.resultR).toFixed(2)}R.`;
  }
  if (o.status === "unfilled") return `${describeOutcome(o)}.`;
  return `Without a trade, the scenario ran ${total.toLocaleString()} candles on the 1m. The chart above shows all of it.`;
}
