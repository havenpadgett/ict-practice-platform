// What the training history says, derived from the attempts alone (no table
// of its own): confidence against process, Correct Avoidance Rate, the most
// frequent structured mistake, and how process and outcome part ways. Pure.
// Placement tasks are measurement, not practice, so they are left out of
// every figure here.

import type { StoredScenarioAttempt } from "@/lib/engine/attempt-row";
import type { MistakeId } from "@/lib/engine/types";

/** Fewest samples before a rate is shown as a percentage. */
export const MIN_SAMPLES = 3;

export type Calibration = {
  rated: number;
  levels: { confidence: 1 | 2 | 3 | 4 | 5; attempts: number; avgScore: number | null }[];
  /** Confidence 4-5 with a process score under 55. */
  highConfidenceLowScore: number;
  /** Confidence 1-2 with a process score of 80 or more. */
  lowConfidenceHighScore: number;
  insight: string | null;
};

export type Avoidance = {
  noTradeAttempts: number;
  avoided: number;
  /** null below MIN_SAMPLES. */
  rate: number | null;
  validAttempts: number;
  skippedValid: number;
  skipRate: number | null;
};

export type TrainingSummary = {
  total: number;
  avgScore: number | null;
  recentAvgScore: number | null;
  calibration: Calibration;
  avoidance: Avoidance;
  mistakes: { id: MistakeId; count: number; lastAt: string }[];
  topMistake: { id: MistakeId; count: number } | null;
  /** A well-made trade that lost, and a poorly made one that won. */
  goodProcessLosses: number;
  badProcessWins: number;
  byMode: Record<string, { attempts: number; avgScore: number }>;
};

const avg = (xs: number[]): number | null => (xs.length === 0 ? null : xs.reduce((a, b) => a + b, 0) / xs.length);

export function practiceOnly(attempts: StoredScenarioAttempt[]): StoredScenarioAttempt[] {
  return attempts.filter((a) => a.mode_id !== "placement");
}

export function summarizeTraining(all: StoredScenarioAttempt[]): TrainingSummary {
  const attempts = practiceOnly(all).sort((a, b) => a.created_at.localeCompare(b.created_at));

  const rated = attempts.filter((a) => a.confidence !== null);
  const levels = ([1, 2, 3, 4, 5] as const).map((c) => {
    const at = rated.filter((a) => a.confidence === c);
    return { confidence: c, attempts: at.length, avgScore: avg(at.map((a) => a.score)) };
  });
  const highConfidenceLowScore = rated.filter((a) => (a.confidence as number) >= 4 && a.score < 55).length;
  const lowConfidenceHighScore = rated.filter((a) => (a.confidence as number) <= 2 && a.score >= 80).length;
  const high = avg(rated.filter((a) => (a.confidence as number) >= 4).map((a) => a.score));
  const low = avg(rated.filter((a) => (a.confidence as number) <= 2).map((a) => a.score));
  let insight: string | null = null;
  if (rated.length >= MIN_SAMPLES * 2) {
    if (highConfidenceLowScore >= 2) insight = `${highConfidenceLowScore} times you were confident (4 or 5) and the process scored under 55. Confidence isn't tracking your reads yet.`;
    else if (high !== null && low !== null && low > high) insight = `Your low-confidence reads scored higher (${Math.round(low)}) than your high-confidence ones (${Math.round(high)}). You may be underrating your own process.`;
    else if (lowConfidenceHighScore >= 2) insight = `${lowConfidenceHighScore} times you doubted a read that scored 80 or more. Trust the checklist you just followed.`;
    else if (high !== null) insight = `Your confident reads average ${Math.round(high)}: confidence and process are lining up.`;
  }

  const noTrade = attempts.filter((a) => a.no_trade_scenario);
  const avoided = noTrade.filter((a) => a.correct_avoidance === true).length;
  const valid = attempts.filter((a) => !a.no_trade_scenario && a.mode_id !== "false_positive" && a.mode_id !== "find_everything" && a.decision !== null);
  const skippedValid = valid.filter((a) => a.decision === "no_trade" || a.decision === "wait").length;

  const counts = new Map<MistakeId, { count: number; lastAt: string }>();
  for (const a of attempts) for (const m of a.mistakes) {
    const c = counts.get(m) ?? { count: 0, lastAt: "" };
    counts.set(m, { count: c.count + 1, lastAt: a.created_at > c.lastAt ? a.created_at : c.lastAt });
  }
  const mistakes = [...counts.entries()].map(([id, v]) => ({ id, ...v })).sort((a, b) => b.count - a.count || b.lastAt.localeCompare(a.lastAt) || a.id.localeCompare(b.id));

  const byMode: TrainingSummary["byMode"] = {};
  for (const a of attempts) {
    const m = byMode[a.mode_id] ?? { attempts: 0, avgScore: 0 };
    byMode[a.mode_id] = { attempts: m.attempts + 1, avgScore: m.avgScore + (a.score - m.avgScore) / (m.attempts + 1) };
  }

  return {
    total: attempts.length,
    avgScore: avg(attempts.map((a) => a.score)),
    recentAvgScore: avg(attempts.slice(-10).map((a) => a.score)),
    calibration: { rated: rated.length, levels, highConfidenceLowScore, lowConfidenceHighScore, insight },
    avoidance: {
      noTradeAttempts: noTrade.length,
      avoided,
      rate: noTrade.length >= MIN_SAMPLES ? avoided / noTrade.length : null,
      validAttempts: valid.length,
      skippedValid,
      skipRate: valid.length >= MIN_SAMPLES ? skippedValid / valid.length : null,
    },
    mistakes,
    topMistake: mistakes[0] ? { id: mistakes[0].id, count: mistakes[0].count } : null,
    goodProcessLosses: attempts.filter((a) => a.score >= 80 && a.result_r !== null && a.result_r < 0).length,
    badProcessWins: attempts.filter((a) => a.score < 60 && a.result_r !== null && a.result_r > 0).length,
    byMode,
  };
}
