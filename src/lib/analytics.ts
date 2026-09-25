// Pure aggregation over DbAttempt[] for the /analytics page. No Supabase
// calls here (src/lib/attempts.ts owns fetching) — this only derives
// numbers, kept separate so the page/components stay display-only.

import { getExerciseMeta } from "@/data/catalog";
import type { DbAttempt } from "@/lib/attempts";

export type OverallStats = {
  accuracy: number | null;
  totalExercises: number;
  totalSessions: number;
};

/** For attempts recorded before session_id was stored (2026-09-25), a gap
 * this long between two consecutive attempts (any concept) is treated as
 * the boundary between practice sessions. 30 minutes is
 * generous enough that reading feedback or a short break mid-session never
 * splits it into two, and tight enough that a same-day return visit counts
 * as a new one. Cheap to author, easy to retune later — same reasoning as
 * grading.ts's fixed tolerances. */
const SESSION_GAP_MS = 30 * 60 * 1000;

/** Attempts recorded since 2026-09-25 carry their session_id, so those
 * sessions are counted exactly; older attempts (null) fall back to the
 * 30-minute gap rule. */
function countSessions(attemptsAscending: DbAttempt[]): number {
  const tagged = new Set(attemptsAscending.map((a) => a.session_id).filter((id): id is string => !!id));
  return tagged.size + countSessionsByGap(attemptsAscending.filter((a) => !a.session_id));
}

function countSessionsByGap(attemptsAscending: DbAttempt[]): number {
  if (attemptsAscending.length === 0) return 0;
  let sessions = 1;
  for (let i = 1; i < attemptsAscending.length; i++) {
    const gap =
      new Date(attemptsAscending[i].created_at).getTime() -
      new Date(attemptsAscending[i - 1].created_at).getTime();
    if (gap > SESSION_GAP_MS) sessions += 1;
  }
  return sessions;
}

/** Assumes `attempts` is sorted ascending by created_at (fetchAttempts
 * guarantees this). */
export function getOverallStats(attempts: DbAttempt[]): OverallStats {
  if (attempts.length === 0) {
    return { accuracy: null, totalExercises: 0, totalSessions: 0 };
  }
  const correct = attempts.filter((a) => a.is_correct).length;
  return {
    accuracy: Math.round((correct / attempts.length) * 100),
    totalExercises: attempts.length,
    totalSessions: countSessions(attempts),
  };
}

export type ConceptHighlight = { concept: string; accuracy: number };

/** Named plainly per the strongest/weakest concept, from the same
 * accuracy-by-concept map the dashboard already computes (getAccuracyByConcept
 * in attempts.ts). Returns null only when no concept has any attempts yet. */
export function getStrongestAndWeakestConcept(
  byConcept: Record<string, number>,
): { strongest: ConceptHighlight; weakest: ConceptHighlight } | null {
  const entries = Object.entries(byConcept);
  if (entries.length === 0) return null;
  let strongest = entries[0];
  let weakest = entries[0];
  for (const entry of entries) {
    if (entry[1] > strongest[1]) strongest = entry;
    if (entry[1] < weakest[1]) weakest = entry;
  }
  return {
    strongest: { concept: strongest[0], accuracy: strongest[1] },
    weakest: { concept: weakest[0], accuracy: weakest[1] },
  };
}

export type ExerciseAccuracy = {
  exerciseId: string;
  /** answerLabel of the exercise (e.g. "Fair Value Gap"), falling back to
   * the exercise_id itself if the exercise can't be found (data removed or
   * renamed since the attempt was recorded). */
  label: string;
  concept: string;
  total: number;
  correct: number;
  missed: number;
  accuracy: number;
};

/** Sorted most-missed first — the PRD asks "which specific exercises are
 * missed most", so miss count (not accuracy %) drives the ranking; a 1/1
 * exercise (0% accuracy, 1 miss) shouldn't outrank a 3/10 one (3 misses)
 * just because its percentage looks worse. Ties break by accuracy, lowest
 * first. */
export function getAccuracyByExercise(attempts: DbAttempt[]): ExerciseAccuracy[] {
  const byExercise = new Map<string, { concept: string; correct: number; total: number }>();
  for (const attempt of attempts) {
    const entry = byExercise.get(attempt.exercise_id) ?? {
      concept: attempt.concept,
      correct: 0,
      total: 0,
    };
    entry.total += 1;
    if (attempt.is_correct) entry.correct += 1;
    byExercise.set(attempt.exercise_id, entry);
  }
  return Array.from(byExercise.entries())
    .map(([exerciseId, { concept, correct, total }]) => ({
      exerciseId,
      label: getExerciseMeta(exerciseId)?.answerLabel ?? exerciseId,
      concept,
      total,
      correct,
      missed: total - correct,
      accuracy: Math.round((correct / total) * 100),
    }))
    .sort((a, b) => b.missed - a.missed || a.accuracy - b.accuracy);
}

/** Accuracy per difficulty level (1-3), e.g. { 1: 90, 2: 60, 3: 40} — only
 * for levels with at least one recorded attempt. Attempts recorded before
 * the difficulty column existed (null) are excluded rather than counted
 * under any particular level. */
export function getAccuracyByDifficulty(
  attempts: { difficulty: 1 | 2 | 3 | null; is_correct: boolean }[],
): Record<number, number> {
  const byDifficulty = new Map<number, { correct: number; total: number }>();
  for (const attempt of attempts) {
    if (attempt.difficulty === null) continue;
    const entry = byDifficulty.get(attempt.difficulty) ?? { correct: 0, total: 0 };
    entry.total += 1;
    if (attempt.is_correct) entry.correct += 1;
    byDifficulty.set(attempt.difficulty, entry);
  }
  const result: Record<number, number> = {};
  for (const [difficulty, { correct, total }] of byDifficulty) {
    result[difficulty] = Math.round((correct / total) * 100);
  }
  return result;
}

export type ResponseTimeStats = {
  avgCorrectMs: number | null;
  avgIncorrectMs: number | null;
};

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round(values.reduce((sum, v) => sum + v, 0) / values.length);
}

export function getResponseTimeStats(attempts: DbAttempt[]): ResponseTimeStats {
  const correct = attempts.filter((a) => a.is_correct).map((a) => a.response_time_ms);
  const incorrect = attempts.filter((a) => !a.is_correct).map((a) => a.response_time_ms);
  return {
    avgCorrectMs: average(correct),
    avgIncorrectMs: average(incorrect),
  };
}

/** e.g. 8300 -> "8.3s". Response times are always sub-minute in practice
 * (one exercise, one drawn answer), so no minutes formatting is needed. */
export function formatResponseTime(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

export type GuidedStepAccuracy = { step: "bias" | "entry" | "stop" | "target"; accuracy: number; count: number };

/** Accuracy per Guided Entry step (bias/entry/stop/target), each computed
 * only over attempts that actually reached that step — a step's
 * guided_*_correct flag is null (not false) when the user bailed with "No
 * Trade" before placing it, so those attempts are excluded from that
 * step's denominator rather than counted against it. Only guided attempts
 * (answer_type = 'guided') are considered; empty array if there are none. */
export function getGuidedStepAccuracy(attempts: DbAttempt[]): GuidedStepAccuracy[] {
  const guided = attempts.filter((a) => a.answer_type === "guided");
  const steps: { step: GuidedStepAccuracy["step"]; field: keyof DbAttempt }[] = [
    { step: "bias", field: "guided_bias_correct" },
    { step: "entry", field: "guided_entry_correct" },
    { step: "stop", field: "guided_stop_correct" },
    { step: "target", field: "guided_target_correct" },
  ];
  const result: GuidedStepAccuracy[] = [];
  for (const { step, field } of steps) {
    const reached = guided.filter((a) => a[field] !== null);
    if (reached.length === 0) continue;
    const correct = reached.filter((a) => a[field] === true).length;
    result.push({ step, accuracy: Math.round((correct / reached.length) * 100), count: reached.length });
  }
  return result;
}

export type FreeTradeCheckAccuracy = {
  check: "direction" | "entry" | "stop" | "rr" | "decision";
  accuracy: number;
  count: number;
};

export type FreeTradeStats = {
  /** Pass rate per process check, each only over attempts where the check
   * applied (a free_*_correct flag is null, not false, when it didn't —
   * e.g. entry on a No Trade decision). */
  checks: FreeTradeCheckAccuracy[];
  scenarios: number;
  trades: number;
  wins: number;
  losses: number;
  /** Sum of result-in-R across every trade taken (open trades included at
   * their session-end mark). */
  totalR: number;
};

/** Free Trade only (answer_type = 'free'); null if there are no attempts. */
export function getFreeTradeStats(attempts: DbAttempt[]): FreeTradeStats | null {
  const free = attempts.filter((a) => a.answer_type === "free");
  if (free.length === 0) return null;
  const fields: { check: FreeTradeCheckAccuracy["check"]; field: keyof DbAttempt }[] = [
    { check: "decision", field: "free_decision_correct" },
    { check: "direction", field: "free_direction_correct" },
    { check: "entry", field: "free_entry_correct" },
    { check: "stop", field: "free_stop_correct" },
    { check: "rr", field: "free_rr_correct" },
  ];
  const checks: FreeTradeCheckAccuracy[] = [];
  for (const { check, field } of fields) {
    const applied = free.filter((a) => a[field] !== null);
    if (applied.length === 0) continue;
    const passed = applied.filter((a) => a[field] === true).length;
    checks.push({ check, accuracy: Math.round((passed / applied.length) * 100), count: applied.length });
  }
  const trades = free.filter((a) => a.free_direction === "long" || a.free_direction === "short");
  return {
    checks,
    scenarios: free.length,
    trades: trades.length,
    wins: trades.filter((a) => a.free_outcome === "win").length,
    losses: trades.filter((a) => a.free_outcome === "loss").length,
    totalR: trades.reduce((sum, a) => sum + (a.free_result_r ?? 0), 0),
  };
}

export type TrendPoint = { attempt: number; accuracy: number; date: string };

/** Rolling accuracy over the last `window` attempts, one point per attempt
 * from the window-th onward (or a single point over everything when there
 * are fewer). Assumes ascending created_at. */
export function getAccuracyTrend(attempts: DbAttempt[], window = 10): TrendPoint[] {
  if (attempts.length === 0) return [];
  const w = Math.min(window, attempts.length);
  const points: TrendPoint[] = [];
  let correct = attempts.slice(0, w).filter((a) => a.is_correct).length;
  for (let i = w - 1; i < attempts.length; i++) {
    if (i >= w) correct += (attempts[i].is_correct ? 1 : 0) - (attempts[i - w].is_correct ? 1 : 0);
    points.push({ attempt: i + 1, accuracy: Math.round((correct / w) * 100), date: attempts[i].created_at.slice(0, 10) });
  }
  return points;
}

export type RateCount = { accuracy: number; count: number };

function rate(list: { is_correct: boolean }[]): RateCount | null {
  if (list.length === 0) return null;
  return { accuracy: Math.round((list.filter((a) => a.is_correct).length / list.length) * 100), count: list.length };
}

/** concept -> difficulty (1-3) -> accuracy and count. Attempts without a
 * recorded difficulty are left out. */
export function getAccuracyByConceptAndDifficulty(attempts: DbAttempt[]): Record<string, Partial<Record<1 | 2 | 3, RateCount>>> {
  const out: Record<string, Partial<Record<1 | 2 | 3, RateCount>>> = {};
  const concepts = Array.from(new Set(attempts.map((a) => a.concept)));
  for (const concept of concepts) {
    for (const d of [1, 2, 3] as const) {
      const r = rate(attempts.filter((a) => a.concept === concept && a.difficulty === d));
      if (r) (out[concept] ??= {})[d] = r;
    }
  }
  return out;
}

export type RealVsConstructed = {
  real: RateCount | null;
  constructed: RateCount | null;
  /** Per concept, only where both kinds have attempts — the fair comparison. */
  byConcept: { concept: string; real: RateCount; constructed: RateCount }[];
};

/** Real-data scenarios (those with provenance) vs hand-built exercises. */
export function getRealVsConstructed(attempts: DbAttempt[]): RealVsConstructed {
  const isReal = (a: DbAttempt) => getExerciseMeta(a.exercise_id)?.real === true;
  const real = attempts.filter(isReal);
  const constructed = attempts.filter((a) => !isReal(a));
  const byConcept: RealVsConstructed["byConcept"] = [];
  for (const concept of Array.from(new Set(real.map((a) => a.concept)))) {
    const r = rate(real.filter((a) => a.concept === concept));
    const c = rate(constructed.filter((a) => a.concept === concept));
    if (r && c) byConcept.push({ concept, real: r, constructed: c });
  }
  return { real: rate(real), constructed: rate(constructed), byConcept };
}

export type ProcessVsOutcome = {
  /** Scenarios where every applicable process check passed. */
  processPassRate: RateCount;
  /** Trades that hit their target, out of trades that closed as a win or a loss. */
  winRate: RateCount | null;
  /** Counts in each process x outcome cell, over closed trades. */
  cells: { goodWin: number; goodLoss: number; badWin: number; badLoss: number };
};

export function getFreeTradeProcessVsOutcome(attempts: DbAttempt[]): ProcessVsOutcome | null {
  const free = attempts.filter((a) => a.answer_type === "free");
  if (free.length === 0) return null;
  const closed = free.filter((a) => a.free_outcome === "win" || a.free_outcome === "loss");
  const count = (good: boolean, win: boolean) =>
    closed.filter((a) => a.is_correct === good && (a.free_outcome === "win") === win).length;
  return {
    processPassRate: rate(free)!,
    winRate: closed.length
      ? { accuracy: Math.round((closed.filter((a) => a.free_outcome === "win").length / closed.length) * 100), count: closed.length }
      : null,
    cells: { goodWin: count(true, true), goodLoss: count(true, false), badWin: count(false, true), badLoss: count(false, false) },
  };
}
