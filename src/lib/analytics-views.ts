// The analytics page's aggregates, from the database views
// (supabase/migrations/20260926120000_analytics_views.sql, documented in
// docs/SQL-QUERIES.md) when they exist, or computed in the browser from the
// raw attempts (src/lib/analytics.ts) when they don't — e.g. before that
// migration is applied. tests/sql/parity.test.ts checks both paths give
// the same numbers on the same data.

import { getExerciseMeta } from "@/data/catalog";
import type { DbAttempt } from "@/lib/attempts";
import { getAccuracyByConcept } from "@/lib/attempts";
import {
  getAccuracyByConceptAndDifficulty,
  getAccuracyByDifficulty,
  getAccuracyByExercise,
  getFreeTradeProcessVsOutcome,
  getGuidedStepAccuracy,
  getRealVsConstructed,
  getResponseTimeStats,
  type ExerciseAccuracy,
  type GuidedStepAccuracy,
  type ProcessVsOutcome,
  type RateCount,
  type RealVsConstructed,
  type ResponseTimeStats,
} from "@/lib/analytics";
import { createClient } from "@/lib/supabase/client";

export type Aggregates = {
  source: "database" | "browser";
  byConcept: Record<string, number>;
  byDifficulty: Record<number, number>;
  conceptDifficulty: Record<string, Partial<Record<1 | 2 | 3, RateCount>>>;
  byExercise: ExerciseAccuracy[];
  responseTime: ResponseTimeStats;
  guidedSteps: GuidedStepAccuracy[];
  realVsConstructed: RealVsConstructed;
  processVsOutcome: ProcessVsOutcome | null;
};

type Num = number | string | null;
export type ViewRows = {
  concept: { concept: string; attempts: Num; accuracy: Num }[];
  conceptDifficulty: { concept: string; difficulty: Num; attempts: Num; correct: Num }[];
  exercise: { exercise_id: string; concept: string; attempts: Num; correct: Num }[];
  realVsConstructed: { concept: string; source: "real" | "constructed"; attempts: Num; correct: Num; accuracy: Num }[];
  guided: { step: GuidedStepAccuracy["step"]; step_order: Num; reached: Num; accuracy: Num }[];
  freeTrade: {
    scenarios: Num;
    process_pass_rate: Num;
    closed_trades: Num;
    win_rate: Num;
    good_process_wins: Num;
    good_process_losses: Num;
    bad_process_wins: Num;
    bad_process_losses: Num;
  }[];
  responseTime: { is_correct: boolean; attempts: Num; avg_ms: Num }[];
};

const n = (v: Num): number => (v === null ? 0 : Number(v));
const pct = (fraction: Num): number => Math.round(n(fraction) * 100);

export function aggregatesFromAttempts(attempts: DbAttempt[]): Aggregates {
  return {
    source: "browser",
    byConcept: getAccuracyByConcept(attempts),
    byDifficulty: getAccuracyByDifficulty(attempts),
    conceptDifficulty: getAccuracyByConceptAndDifficulty(attempts),
    byExercise: getAccuracyByExercise(attempts),
    responseTime: getResponseTimeStats(attempts),
    guidedSteps: getGuidedStepAccuracy(attempts),
    realVsConstructed: getRealVsConstructed(attempts),
    processVsOutcome: getFreeTradeProcessVsOutcome(attempts),
  };
}

function rate(correct: number, total: number): RateCount {
  return { accuracy: Math.round((correct / total) * 100), count: total };
}

export function aggregatesFromViews(v: ViewRows): Aggregates {
  const byConcept: Record<string, number> = {};
  for (const r of v.concept) byConcept[r.concept] = pct(r.accuracy);

  const conceptDifficulty: Aggregates["conceptDifficulty"] = {};
  const byDiff = new Map<number, { correct: number; total: number }>();
  for (const r of v.conceptDifficulty) {
    const d = n(r.difficulty) as 1 | 2 | 3;
    (conceptDifficulty[r.concept] ??= {})[d] = rate(n(r.correct), n(r.attempts));
    const e = byDiff.get(d) ?? { correct: 0, total: 0 };
    byDiff.set(d, { correct: e.correct + n(r.correct), total: e.total + n(r.attempts) });
  }
  const byDifficulty: Record<number, number> = {};
  for (const [d, e] of byDiff) byDifficulty[d] = Math.round((e.correct / e.total) * 100);

  const byExercise: ExerciseAccuracy[] = v.exercise
    .map((r) => ({
      exerciseId: r.exercise_id,
      label: getExerciseMeta(r.exercise_id)?.answerLabel ?? r.exercise_id,
      concept: r.concept,
      total: n(r.attempts),
      correct: n(r.correct),
      missed: n(r.attempts) - n(r.correct),
      accuracy: Math.round((n(r.correct) / n(r.attempts)) * 100),
    }))
    .sort((a, b) => b.missed - a.missed || a.accuracy - b.accuracy);

  const rt = (correct: boolean) => {
    const rows = v.responseTime.filter((r) => r.is_correct === correct);
    const total = rows.reduce((s, r) => s + n(r.attempts), 0);
    return total ? Math.round(rows.reduce((s, r) => s + n(r.avg_ms) * n(r.attempts), 0) / total) : null;
  };

  const sum = (src: "real" | "constructed") => {
    const rows = v.realVsConstructed.filter((r) => r.source === src);
    const total = rows.reduce((s, r) => s + n(r.attempts), 0);
    if (!total) return null;
    const correct = rows.reduce((s, r) => s + n(r.correct), 0);
    return rate(correct, total);
  };
  const byConceptRvC: RealVsConstructed["byConcept"] = [];
  for (const concept of Array.from(new Set(v.realVsConstructed.filter((r) => r.source === "real").map((r) => r.concept)))) {
    const real = v.realVsConstructed.find((r) => r.concept === concept && r.source === "real");
    const con = v.realVsConstructed.find((r) => r.concept === concept && r.source === "constructed");
    if (real && con) {
      byConceptRvC.push({
        concept,
        real: { accuracy: pct(real.accuracy), count: n(real.attempts) },
        constructed: { accuracy: pct(con.accuracy), count: n(con.attempts) },
      });
    }
  }

  const ft = v.freeTrade[0];
  return {
    source: "database",
    byConcept,
    byDifficulty,
    conceptDifficulty,
    byExercise,
    responseTime: { avgCorrectMs: rt(true), avgIncorrectMs: rt(false) },
    guidedSteps: [...v.guided]
      .sort((a, b) => n(a.step_order) - n(b.step_order))
      .map((r) => ({ step: r.step, accuracy: pct(r.accuracy), count: n(r.reached) })),
    realVsConstructed: { real: sum("real"), constructed: sum("constructed"), byConcept: byConceptRvC },
    processVsOutcome: ft
      ? {
          processPassRate: { accuracy: pct(ft.process_pass_rate), count: n(ft.scenarios) },
          winRate: n(ft.closed_trades) ? { accuracy: pct(ft.win_rate), count: n(ft.closed_trades) } : null,
          cells: {
            goodWin: n(ft.good_process_wins),
            goodLoss: n(ft.good_process_losses),
            badWin: n(ft.bad_process_wins),
            badLoss: n(ft.bad_process_losses),
          },
        }
      : null,
  };
}

const VIEWS: Record<keyof ViewRows, string> = {
  concept: "v_accuracy_by_concept",
  conceptDifficulty: "v_accuracy_by_concept_difficulty",
  exercise: "v_exercise_success",
  realVsConstructed: "v_real_vs_constructed",
  guided: "v_guided_step_accuracy",
  freeTrade: "v_free_trade_process_vs_outcome",
  responseTime: "v_response_time",
};

/** The signed-in user's view rows, or null if the views don't exist yet
 * (or can't be read), in which case the caller computes in the browser.
 * RLS on attempts (security_invoker views) scopes every view to the
 * caller; v_exercise_success has no user_id column and is scoped the same
 * way. */
export async function fetchViewRows(userId: string): Promise<ViewRows | null> {
  const supabase = createClient();
  try {
    const entries = await Promise.all(
      (Object.keys(VIEWS) as (keyof ViewRows)[]).map(async (key) => {
        let query = supabase.from(VIEWS[key]).select("*");
        if (key !== "exercise") query = query.eq("user_id", userId);
        const { data, error } = await query;
        if (error) throw error;
        return [key, data] as const;
      }),
    );
    return Object.fromEntries(entries) as unknown as ViewRows;
  } catch {
    return null;
  }
}
