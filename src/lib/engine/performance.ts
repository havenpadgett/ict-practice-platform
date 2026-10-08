// Performance analytics for scenario attempts: how each part of the process
// is going, calibration against confidence, and where the numbers differ by
// setup, session, timeframe and difficulty. Derived from the stored attempts
// alone (process dimensions, skill evidence, mistakes, the catalog); nothing
// is estimated or filled in. Every figure carries its sample size, and a
// rate below MIN_SAMPLES is null so the screen can't overstate it.
// Placement tasks are measurement, not practice, and are left out. Pure.

import type { StoredScenarioAttempt } from "@/lib/engine/attempt-row";
import { MIN_SAMPLES, practiceOnly, summarizeTraining } from "@/lib/engine/history";
import { MISTAKE_LABEL } from "@/lib/engine/review";
import { SESSION_LABEL, SESSIONS, type SessionId } from "@/lib/engine/session";
import { SETUPS, scenariosForSetup } from "@/lib/engine/setups";
import type { ScenarioMeta } from "@/lib/engine/store";
import { VERDICT_CUTOFFS } from "@/lib/engine/config";
import { TIMEFRAMES, type Timeframe } from "@/lib/engine/time";
import type { Dimension, SkillId, StageResponse } from "@/lib/engine/types";

/** Fewest samples before a sentence makes a claim about a rate. */
export const INSIGHT_MIN = 5;

export type MetricId = "htf_bias" | "liquidity" | "structure" | "recognition" | "poi_entry" | "stop" | "target" | "trade_selection";

type MetricDef = { id: MetricId; label: string; dimensions?: Dimension[]; skill?: SkillId };

/** The eight parts of the process shown to a learner, and where each is read
 * from. Market Structure and Setup Recognition come from the skill evidence
 * (the dimensions that imply those skills), the rest from the dimension itself. */
export const METRICS: MetricDef[] = [
  { id: "htf_bias", label: "HTF Bias", dimensions: ["htf_bias"] },
  { id: "liquidity", label: "Liquidity Read", dimensions: ["liquidity_read"] },
  { id: "structure", label: "Market Structure", skill: "market_structure" },
  { id: "recognition", label: "Setup Recognition", skill: "concept_recognition" },
  { id: "poi_entry", label: "POI / Entry Location", dimensions: ["poi_selection", "entry_location"] },
  { id: "stop", label: "Stop Placement", dimensions: ["stop_placement"] },
  { id: "target", label: "Target Selection", dimensions: ["target_selection"] },
  { id: "trade_selection", label: "Trade Selection", dimensions: ["trade_selection"] },
];

const avg = (xs: number[]): number | null => (xs.length === 0 ? null : xs.reduce((a, b) => a + b, 0) / xs.length);

/** One 0-100 score for a metric on an attempt, or null if it never applied. */
export function metricScore(a: StoredScenarioAttempt, m: MetricDef): number | null {
  if (m.skill) {
    const ev = (a.skill_evidence ?? []).filter((e) => e.skill === m.skill && typeof e.score === "number");
    return ev.length === 0 ? null : (avg(ev.map((e) => e.score)) as number) * 100;
  }
  const hit = (a.dimensions ?? []).filter((d) => d.applicable && m.dimensions?.includes(d.dimension));
  return hit.length === 0 ? null : (avg(hit.map((d) => d.score)) as number);
}

export type MetricStat = {
  id: MetricId;
  label: string;
  /** Attempts the metric applied to. */
  n: number;
  avgScore: number | null;
  /** Share scoring 80 or more ("read correctly"); null below MIN_SAMPLES. */
  correctRate: number | null;
  /** Average 1-5 confidence on those attempts (rated ones), with how many. */
  avgConfidence: number | null;
  ratedN: number;
};

export type Slice = { key: string; label: string; n: number; avgScore: number | null; correctRate: number | null };

export type OverTimePoint = { upTo: number; avgScore: number; n: number };

export type PerformanceReport = {
  total: number;
  avgScore: number | null;
  metrics: MetricStat[];
  avoidance: ReturnType<typeof summarizeTraining>["avoidance"];
  /** Trades taken that the decision dimension (or a no-trade chart) says didn't hold up. */
  falsePositive: { trades: number; wrong: number; rate: number | null };
  mistakes: { id: string; label: string; count: number; perAttempt: number }[];
  bySetup: Slice[];
  bySession: Slice[];
  byTimeframe: Slice[];
  byDifficulty: Slice[];
  overTime: OverTimePoint[];
  confidenceGap: { metric: MetricStat; confidence: number; accuracy: number } | null;
  insights: string[];
};

/** The timeframe a learner did most of their marking on, from the marks
 * they drew (not from hindsight). Null when they drew nothing. */
export function workingTimeframe(a: StoredScenarioAttempt): Timeframe | null {
  const counts = new Map<Timeframe, number>();
  const stages: Record<string, StageResponse> = a.response?.stages ?? {};
  for (const r of Object.values(stages)) {
    const marks = r.kind === "mark" || r.kind === "replay" ? r.annotations : [];
    for (const m of marks) if (m.tf && !m.hindsight && (TIMEFRAMES as readonly string[]).includes(m.tf)) counts.set(m.tf, (counts.get(m.tf) ?? 0) + 1);
  }
  let best: Timeframe | null = null;
  for (const tf of TIMEFRAMES) if ((counts.get(tf) ?? 0) > (best ? (counts.get(best) ?? 0) : 0)) best = tf;
  return best;
}

function slice(key: string, label: string, list: StoredScenarioAttempt[]): Slice {
  const scores = list.map((a) => a.score);
  return {
    key,
    label,
    n: list.length,
    avgScore: avg(scores),
    correctRate: list.length >= MIN_SAMPLES ? scores.filter((s) => s >= VERDICT_CUTOFFS.correct).length / list.length : null,
  };
}

const pct = (x: number) => `${Math.round(x * 100)}%`;
const DIFF_LABEL = { 1: "Foundation", 2: "Intermediate", 3: "Advanced" } as const;

export function buildPerformance(all: StoredScenarioAttempt[], catalog: ScenarioMeta[]): PerformanceReport {
  const attempts = practiceOnly(all).sort((a, b) => a.created_at.localeCompare(b.created_at));
  const summary = summarizeTraining(attempts);
  const meta = new Map(catalog.map((m) => [m.id, m]));

  const metrics: MetricStat[] = METRICS.map((m) => {
    const rows = attempts.map((a) => ({ a, s: metricScore(a, m) })).filter((r): r is { a: StoredScenarioAttempt; s: number } => r.s !== null);
    const rated = rows.filter((r) => r.a.confidence !== null);
    return {
      id: m.id,
      label: m.label,
      n: rows.length,
      avgScore: avg(rows.map((r) => r.s)),
      correctRate: rows.length >= MIN_SAMPLES ? rows.filter((r) => r.s >= VERDICT_CUTOFFS.correct).length / rows.length : null,
      avgConfidence: avg(rated.map((r) => r.a.confidence as number)),
      ratedN: rated.length,
    };
  });

  // False positives: a trade taken where it did not hold up.
  const traded = attempts.filter((a) => a.decision === "long" || a.decision === "short");
  const wrong = traded.filter((a) => {
    if (a.no_trade_scenario) return true;
    const d = (a.dimensions ?? []).find((x) => x.dimension === "trade_selection" && x.applicable);
    return d !== undefined && d.score < VERDICT_CUTOFFS.couldImprove;
  });
  const falsePositive = { trades: traded.length, wrong: wrong.length, rate: traded.length >= MIN_SAMPLES ? wrong.length / traded.length : null };

  const mistakes = summary.mistakes.map((m) => ({ id: m.id, label: MISTAKE_LABEL[m.id], count: m.count, perAttempt: attempts.length ? m.count / attempts.length : 0 }));

  const bySetup = SETUPS.map((s) => {
    const ids = new Set(scenariosForSetup(s, catalog).map((m) => m.id));
    return slice(s.id, s.label, attempts.filter((a) => ids.has(a.scenario_id)));
  }).filter((s) => s.n > 0);

  const bySession = SESSIONS.map((id: SessionId) => slice(id, SESSION_LABEL[id], attempts.filter((a) => meta.get(a.scenario_id)?.session === id))).filter((s) => s.n > 0);

  const byTimeframe = TIMEFRAMES.map((tf) => slice(tf, tf, attempts.filter((a) => workingTimeframe(a) === tf))).filter((s) => s.n > 0);

  const byDifficulty = ([1, 2, 3] as const).map((d) => slice(String(d), DIFF_LABEL[d], attempts.filter((a) => a.difficulty === d))).filter((s) => s.n > 0);

  // Process score over time: the mean of each consecutive block of five.
  const BLOCK = 5;
  const overTime: OverTimePoint[] = [];
  for (let i = BLOCK; i <= attempts.length; i += BLOCK) overTime.push({ upTo: i, avgScore: avg(attempts.slice(i - BLOCK, i).map((a) => a.score)) as number, n: BLOCK });

  // Where stated confidence outruns accuracy the most (needs enough rated attempts).
  let confidenceGap: PerformanceReport["confidenceGap"] = null;
  for (const m of metrics) {
    if (m.ratedN < INSIGHT_MIN || m.avgConfidence === null || m.correctRate === null) continue;
    const conf = (m.avgConfidence - 1) / 4;
    const gap = conf - m.correctRate;
    if (gap >= 0.25 && (confidenceGap === null || gap > confidenceGap.confidence - confidenceGap.accuracy)) confidenceGap = { metric: m, confidence: conf, accuracy: m.correctRate };
  }

  // ---- Plain-English insights, strongest claims first, only with enough data.
  const insights: string[] = [];
  const known = metrics.filter((m) => m.n >= INSIGHT_MIN && m.correctRate !== null);
  const liquidity = metrics.find((m) => m.id === "liquidity");
  if (liquidity && liquidity.n >= INSIGHT_MIN && liquidity.correctRate !== null) insights.push(`You read liquidity correctly ${pct(liquidity.correctRate)} of the time (${liquidity.n} attempts).`);
  const top = summary.topMistake;
  if (top && top.count >= 2) insights.push(`Your most common mistake is ${MISTAKE_LABEL[top.id].toLowerCase()}: ${top.count} of ${attempts.length} attempts.`);
  if (confidenceGap) {
    const high = [...metrics].filter((m) => m.avgConfidence !== null && m.ratedN >= INSIGHT_MIN).sort((a, b) => (b.avgConfidence as number) - (a.avgConfidence as number))[0];
    insights.push(
      high && high.id === confidenceGap.metric.id
        ? `Your confidence is highest on ${high.label}, but your accuracy there (${pct(confidenceGap.accuracy)}) is lower than your confidence suggests.`
        : `On ${confidenceGap.metric.label} your confidence runs ahead of your accuracy (${pct(confidenceGap.accuracy)} read correctly).`,
    );
  }
  const slices = bySetup.filter((s) => s.n >= INSIGHT_MIN && s.avgScore !== null);
  if (slices.length >= 2) {
    const best = [...slices].sort((a, b) => (b.avgScore as number) - (a.avgScore as number))[0];
    insights.push(`Your strongest setup is ${best.label}, averaging ${Math.round(best.avgScore as number)} across ${best.n} attempts.`);
  }
  if (summary.avoidance.rate !== null) insights.push(`You stood aside correctly on ${pct(summary.avoidance.rate)} of no-trade charts (${summary.avoidance.avoided} of ${summary.avoidance.noTradeAttempts}).`);
  if (falsePositive.rate !== null && falsePositive.wrong >= 2 && falsePositive.rate >= 0.3) insights.push(`${pct(falsePositive.rate)} of the trades you took didn't hold up as trades (${falsePositive.wrong} of ${falsePositive.trades}).`);
  if (known.length >= 2) {
    const weakest = [...known].sort((a, b) => (a.correctRate as number) - (b.correctRate as number))[0];
    insights.push(`${weakest.label} is where you get it right least often: ${pct(weakest.correctRate as number)} of ${weakest.n}.`);
  }
  if (overTime.length >= 2) {
    const first = overTime[0].avgScore;
    const last = overTime[overTime.length - 1].avgScore;
    if (Math.abs(last - first) >= 5) insights.push(`Your process score ${last > first ? "rose" : "fell"} from ${Math.round(first)} in your first five scenarios to ${Math.round(last)} in your latest five.`);
  }

  return {
    total: attempts.length,
    avgScore: summary.avgScore,
    metrics,
    avoidance: summary.avoidance,
    falsePositive,
    mistakes,
    bySetup,
    bySession,
    byTimeframe,
    byDifficulty,
    overTime,
    confidenceGap,
    insights: insights.slice(0, 5),
  };
}
