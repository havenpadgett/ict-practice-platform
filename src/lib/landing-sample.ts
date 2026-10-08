// The product shown on the landing page is the product: one seeded scenario
// (sim-001), a plausible attempt at it, and the result the real scorer gives
// that attempt. Nothing here is typed in as a score: the marks, the plan and
// the outcome go through the same scoreAttempt the Simulator uses, and the
// page is labelled as a sample. The attempt is deliberately a good read with
// one execution flaw (a stop inside the invalidation level), so the page can
// show what a process score and a named weakness look like.

import { fromRow, seriesAt, type SimCandle, type TimeframeData } from "@/lib/engine/candles";
import { MODES } from "@/lib/engine/modes";
import { MISTAKE_LABEL } from "@/lib/engine/review";
import { loadScenario } from "@/lib/engine/server-store";
import { scoreAttempt } from "@/lib/engine/scoring";
import { describeOutcome } from "@/lib/engine/trade";
import { DIMENSION_LABEL, type Annotation, type AttemptResponse } from "@/lib/engine/types";
import type { ChartTrade, Plan } from "@/components/sim/chart-types";

export const LANDING_SCENARIO = "sim-001";

export type LandingSample = {
  title: string;
  /** 5m candles up to the decision moment: what the learner sees first. */
  before: SimCandle[];
  /** The same chart after the scenario ran. */
  after: SimCandle[];
  decisionT: number;
  marks: Annotation[];
  plan: Plan;
  trade: ChartTrade | null;
  score: number;
  verdict: string;
  outcome: string;
  dimensions: { label: string; score: number; note: string }[];
  mistakes: string[];
  /** The lowest-scoring part of the process, named. */
  weakest: { label: string; note: string } | null;
};

export async function buildLandingSample(): Promise<LandingSample | null> {
  const s = await loadScenario(LANDING_SCENARIO);
  const trade = s?.reference.trade;
  if (!s || !trade) return null;

  const sweep = s.reference.annotations.find((a) => a.id === "overnight-low");
  const fvg = s.reference.annotations.find((a) => a.id === "fvg-5m");
  const sweepLow = s.reference.annotations.find((a) => a.id === "sweep-low");
  if (!sweep?.price || !fvg?.priceLow || !fvg.priceHigh || !sweepLow?.price) return null;

  const stream = s.data.stream.map(fromRow);
  const decisionT = stream[s.cursorStart - 1].t;
  const entry = Math.round(((fvg.priceLow + fvg.priceHigh) / 2) * 4) / 4;
  const target = trade.targets[0].ideal ?? (trade.targets[0].low + trade.targets[0].high) / 2;
  // A stop just above the sweep low: inside the level that proves the idea wrong.
  const stop = Math.round((trade.stop.invalidation + 3) * 4) / 4;

  const marks: Annotation[] = [
    { id: "m1", kind: "liquidity", price: sweep.price, t: decisionT, tf: "5m", drawnAt: s.cursorStart },
    { id: "m2", kind: "fvg", priceLow: fvg.priceLow, priceHigh: fvg.priceHigh, tStart: fvg.tStart, tEnd: fvg.tEnd, tf: "5m", drawnAt: s.cursorStart },
  ];
  const response: AttemptResponse = {
    scenarioId: s.id,
    modeId: "simulator",
    stages: { replay: { kind: "replay", annotations: marks, bias: "bullish", decision: "long", order: { direction: "long", entry, stop, target, placedAt: s.cursorStart }, waits: 0, decidedAtRevealed: s.cursorStart } },
    confidence: null,
    responseTimeMs: 0,
  };
  const result = scoreAttempt(s, MODES.simulator, response);

  const data: TimeframeData = { history: Object.fromEntries(Object.entries(s.data.history).map(([k, v]) => [k, (v ?? []).map(fromRow)])), stream, streamTimeframe: s.data.streamTimeframe };
  const o = result.outcome;
  const chartTrade: ChartTrade | null =
    o.status === "closed" ? { direction: "long", fillT: stream[o.fillIndex].t, fillPrice: o.fillPrice, exitT: stream[o.exitIndex].t, exitPrice: o.exitPrice, stop, target } : null;
  const endIndex = o.status === "closed" ? Math.min(stream.length, o.exitIndex + 25) : stream.length;

  const dimensions = result.dimensions.filter((d) => d.applicable).map((d) => ({ label: DIMENSION_LABEL[d.dimension], score: Math.round(d.score), note: d.note }));
  const weakest = [...dimensions].sort((a, b) => a.score - b.score)[0];
  return {
    title: s.title,
    before: seriesAt(data, "5m", s.cursorStart),
    after: seriesAt(data, "5m", endIndex),
    decisionT,
    marks,
    plan: { direction: "long", entry, stop, target },
    trade: chartTrade,
    score: result.score,
    verdict: result.verdict,
    outcome: describeOutcome(o),
    dimensions,
    mistakes: result.mistakes.map((m) => MISTAKE_LABEL[m]),
    weakest: weakest && weakest.score < 80 ? { label: weakest.label, note: weakest.note } : null,
  };
}
