// Supabase-backed attempt recording and dashboard aggregates. Exercise
// content stays in code (src/data/exercises.ts) — this only ever touches
// the `attempts` table, which holds nothing but what a specific user did.

import { getExerciseMeta } from "@/data/catalog";
import { createClient } from "@/lib/supabase/client";
import type { StoredAttempt } from "@/lib/storage";
import type { Verdict3 } from "@/lib/verdict";

/** Matches the `attempts` table (supabase/migrations/...create_profiles_and_attempts.sql,
 * widened for Guided Entry by ..._add_guided_fields_to_attempts.sql and for
 * Free Trade by ..._add_free_trade_fields_to_attempts.sql). */
export type DbAttempt = {
  id: string;
  user_id: string;
  exercise_id: string;
  /** The practice session this attempt belongs to (SessionState.session_id,
   * PRD Section 9). Null for attempts recorded before the column existed
   * (supabase/migrations/..._attempts_session_id_and_indexes.sql). */
  session_id: string | null;
  concept: string;
  /** The exercise's difficulty (1-3) at the time of the attempt. Null for
   * attempts recorded before this column existed (supabase/migrations/
   * ..._add_difficulty_to_attempts.sql). */
  difficulty: 1 | 2 | 3 | null;
  answer_type: "zone" | "level" | "choice" | "guided" | "free";
  user_answer_type: "region" | "level" | "choice" | "guided" | "free" | "none";
  user_price_low: number | null;
  user_price_high: number | null;
  user_candle_start: number | null;
  user_candle_end: number | null;
  coverage: number | null;
  precision_ratio: number | null;
  user_price: number | null;
  distance_from_level: number | null;
  user_choice: string | null;
  correct_choice: string | null;
  // Guided Entry fields — populated only when answer_type = 'guided'.
  // Each per-step *_correct flag is null when that step was never reached
  // (the user bailed with "No Trade" before placing it), not when it was
  // reached and graded wrong (that's `false`). guided_*_verdict (Phase B,
  // supabase/migrations/20260929120000_add_verdict_to_attempts.sql) is the
  // richer three-state read of the same step; guided_*_correct is derived
  // from it (isCorrectForCompat) and kept for backward compatibility.
  guided_bias_choice: "bullish" | "bearish" | "unclear" | null;
  guided_entry_price: number | null;
  guided_stop_price: number | null;
  guided_target_price: number | null;
  guided_bias_correct: boolean | null;
  guided_entry_correct: boolean | null;
  guided_stop_correct: boolean | null;
  guided_target_correct: boolean | null;
  guided_bias_verdict: Verdict3 | null;
  guided_entry_verdict: Verdict3 | null;
  guided_stop_verdict: Verdict3 | null;
  guided_target_verdict: Verdict3 | null;
  guided_rr_verdict: Verdict3 | null;
  guided_achieved_rr: number | null;
  /** Whether the user confirmed all four steps as a trade ("Submit Setup")
   * rather than bailing with "No Trade" at some point. */
  guided_declared_trade: boolean | null;
  // Free Trade fields — populated only when answer_type = 'free'. Price,
  // R, and exit fields are null when the user finished with No Trade; each
  // free_*_correct process check is null when it didn't apply (e.g. entry
  // on a no-trade decision), not false. is_correct/verdict hold the overall
  // process verdict — never the win/loss outcome.
  free_direction: "long" | "short" | "none" | null;
  free_entry_price: number | null;
  free_stop_price: number | null;
  free_target_price: number | null;
  free_entry_candle_index: number | null;
  free_exit_candle_index: number | null;
  free_exit_price: number | null;
  free_exit_reason: "stop" | "target" | "session_end" | null;
  free_rr: number | null;
  free_result_r: number | null;
  free_outcome: "win" | "loss" | "open" | "no_trade" | null;
  free_direction_correct: boolean | null;
  free_entry_correct: boolean | null;
  free_stop_correct: boolean | null;
  free_rr_correct: boolean | null;
  free_decision_correct: boolean | null;
  free_direction_verdict: Verdict3 | null;
  free_entry_verdict: Verdict3 | null;
  free_stop_verdict: Verdict3 | null;
  free_target_verdict: Verdict3 | null;
  free_rr_verdict: Verdict3 | null;
  free_decision_verdict: Verdict3 | null;
  is_correct: boolean;
  /** Phase B: the three-state read of is_correct (src/lib/verdict.ts).
   * is_correct = isCorrectForCompat(verdict) whenever verdict is recorded
   * — kept in lockstep so every pre-Phase-B view, dashboard, and analytics
   * computation over is_correct keeps working unchanged. Null only for
   * attempts recorded before this column existed (no migration backfill —
   * see supabase/migrations/20260929120000_add_verdict_to_attempts.sql);
   * every attempt this app writes always sets a real value. */
  verdict: Verdict3 | null;
  failure_reason: string | null;
  response_time_ms: number;
  attempt_number: number;
  created_at: string;
};

export type NewAttempt = Omit<DbAttempt, "id" | "user_id" | "created_at">;

/** Every free_* column as null — spread into inserts for non-Free-Trade
 * attempts. */
export const NULL_FREE_TRADE_FIELDS = {
  free_direction: null,
  free_entry_price: null,
  free_stop_price: null,
  free_target_price: null,
  free_entry_candle_index: null,
  free_exit_candle_index: null,
  free_exit_price: null,
  free_exit_reason: null,
  free_rr: null,
  free_result_r: null,
  free_outcome: null,
  free_direction_correct: null,
  free_entry_correct: null,
  free_stop_correct: null,
  free_rr_correct: null,
  free_decision_correct: null,
  free_direction_verdict: null,
  free_entry_verdict: null,
  free_stop_verdict: null,
  free_target_verdict: null,
  free_rr_verdict: null,
  free_decision_verdict: null,
} satisfies Partial<NewAttempt>;

/** Just what the dashboard reads (overall/concept accuracy and the
 * recommendation engine, including its sub-skill step/check flags) — about
 * a third of a full row. The other columns come back undefined. */
export const DASHBOARD_COLUMNS = [
  "id",
  "exercise_id",
  "session_id",
  "concept",
  "difficulty",
  "answer_type",
  "is_correct",
  "verdict",
  "created_at",
  "guided_bias_correct",
  "guided_entry_correct",
  "guided_stop_correct",
  "guided_target_correct",
  "free_decision_correct",
  "free_direction_correct",
  "free_entry_correct",
  "free_stop_correct",
  "free_rr_correct",
].join(",");

/** Ascending by created_at. `columns` narrows the select for pages that
 * don't need every field; the default is the full row. Falls back to
 * dropping `verdict` from an explicit column list if the migration that
 * adds it (20260929120000, not yet applied — B4) hasn't run: naming an
 * unknown column in `.select()` fails the whole query, not just that
 * field, so this degrades to the plain is_correct reading every caller
 * already had rather than breaking the page. */
export async function fetchAttempts(userId: string, columns = "*"): Promise<DbAttempt[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("attempts")
    .select(columns)
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) {
    if ((error.code === "PGRST204" || error.code === "42703") && columns.includes("verdict")) {
      return fetchAttempts(userId, columns.split(",").filter((c) => c !== "verdict").join(","));
    }
    throw error;
  }
  return (data ?? []) as unknown as DbAttempt[];
}

/** "Repeat exposure to the same exercise" (PRD Section 9) — how many times
 * this exercise_id has been attempted before, across every past session. */
export async function nextAttemptNumber(
  userId: string,
  exerciseId: string,
): Promise<number> {
  const supabase = createClient();
  const { count, error } = await supabase
    .from("attempts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("exercise_id", exerciseId);
  if (error) throw error;
  return (count ?? 0) + 1;
}

/** Fired on window after an attempt is saved, so anything showing derived
 * counts (the nav's open-mistakes badge) can refresh. */
export const ATTEMPTS_CHANGED_EVENT = "ict:attempts-changed";

/** Verdict columns added in 20260929120000_add_verdict_to_attempts.sql —
 * not yet applied in production (B4). Stripped on VERDICT_COLUMNS_MISSING
 * so grading keeps recording attempts (on is_correct alone, as it always
 * did) until the migration runs; same pattern as the report-reasons
 * fallback in src/app/report/actions.ts. */
const VERDICT_COLUMNS: (keyof NewAttempt)[] = [
  "verdict",
  "guided_bias_verdict", "guided_entry_verdict", "guided_stop_verdict", "guided_target_verdict", "guided_rr_verdict",
  "free_direction_verdict", "free_entry_verdict", "free_stop_verdict", "free_target_verdict", "free_rr_verdict", "free_decision_verdict",
];

export async function insertAttempt(
  userId: string,
  attempt: NewAttempt,
): Promise<void> {
  const supabase = createClient();
  let { error } = await supabase
    .from("attempts")
    .insert({ ...attempt, user_id: userId });
  if (error && (error.code === "PGRST204" || error.code === "42703")) {
    const fallback = { ...attempt, user_id: userId };
    for (const col of VERDICT_COLUMNS) delete fallback[col];
    ({ error } = await supabase.from("attempts").insert(fallback));
  }
  if (error) throw error;
  if (typeof window !== "undefined") window.dispatchEvent(new Event(ATTEMPTS_CHANGED_EVENT));
}

/** Migrates attempts recorded before sign-in (in localStorage) to the
 * user's account. The old local shape doesn't record answer_type (it
 * predates that field), so it's derived from the exercise's own data —
 * exercise_id is stable, so the lookup always succeeds for real attempts. */
export async function migrateLocalAttempts(
  userId: string,
  localAttempts: StoredAttempt[],
): Promise<number> {
  if (localAttempts.length === 0) return 0;

  const rows = localAttempts.map((a) => {
    const exercise = getExerciseMeta(a.exercise_id);
    // The answer type is what the user actually did at the time, not what
    // the exercise is today: Liquidity was answered with a box until
    // 2026-09-09, and taking today's "level" recorded a box against a level
    // exercise (Bug Log 2026-09-27).
    const answerType =
      a.user_answer_type === "region"
        ? "zone"
        : a.user_answer_type === "level"
          ? "level"
          : exercise?.answer_type === "level"
            ? "level"
            : "zone";
    return {
      user_id: userId,
      session_id: a.session_id,
      exercise_id: a.exercise_id,
      concept: a.concept,
      difficulty: exercise?.difficulty ?? null,
      answer_type: answerType,
      user_answer_type: a.user_answer_type,
      user_price_low: a.user_price_low,
      user_price_high: a.user_price_high,
      user_candle_start: a.user_candle_start,
      user_candle_end: a.user_candle_end,
      coverage: a.coverage,
      precision_ratio: a.precision_ratio,
      user_price: a.user_price,
      distance_from_level: a.distance_from_level,
      // StoredAttempt (the pre-login localStorage shape) predates the
      // "choice", "guided", and "free" answer types entirely — nothing
      // migrated through it could have been any of those.
      user_choice: null,
      correct_choice: null,
      guided_bias_choice: null,
      guided_entry_price: null,
      guided_stop_price: null,
      guided_target_price: null,
      guided_bias_correct: null,
      guided_entry_correct: null,
      guided_stop_correct: null,
      guided_target_correct: null,
      guided_bias_verdict: null,
      guided_entry_verdict: null,
      guided_stop_verdict: null,
      guided_target_verdict: null,
      guided_rr_verdict: null,
      guided_achieved_rr: null,
      guided_declared_trade: null,
      ...NULL_FREE_TRADE_FIELDS,
      is_correct: a.is_correct,
      // Pre-Phase-B local attempts only ever recorded a boolean — there's
      // no COULD_IMPROVE reading to recover, so the verdict is binary here.
      verdict: a.is_correct ? "correct" : "incorrect",
      failure_reason: a.failure_reason,
      // Same 24-hour cap as the grading Server Functions and the
      // attempts_ranges constraint.
      response_time_ms: Math.min(Math.max(0, Math.round(a.response_time_ms)), 86_400_000),
      attempt_number: Math.max(1, a.attempt_number),
    };
  });

  const supabase = createClient();
  let { error } = await supabase.from("attempts").insert(rows);
  if (error && (error.code === "PGRST204" || error.code === "42703")) {
    const fallback = rows.map((r) => {
      const copy = { ...r } as Record<string, unknown>;
      for (const col of VERDICT_COLUMNS) delete copy[col];
      return copy;
    });
    ({ error } = await supabase.from("attempts").insert(fallback));
  }
  if (error) throw error;
  return rows.length;
}

// ---- Dashboard aggregates -------------------------------------------------
// Same math regardless of source — only `concept` and `is_correct` matter.

export function getOverallAccuracy(attempts: { is_correct: boolean }[]): number | null {
  if (attempts.length === 0) return null;
  const correct = attempts.filter((a) => a.is_correct).length;
  return Math.round((correct / attempts.length) * 100);
}

export function getExercisesCompletedCount(attempts: unknown[]): number {
  return attempts.length;
}

/** Accuracy per concept, e.g. { FVG: 80, Liquidity: 40 } — only for
 * concepts with at least one recorded attempt. */
export function getAccuracyByConcept(
  attempts: { concept: string; is_correct: boolean }[],
): Record<string, number> {
  const byConcept = new Map<string, { correct: number; total: number }>();
  for (const attempt of attempts) {
    const entry = byConcept.get(attempt.concept) ?? { correct: 0, total: 0 };
    entry.total += 1;
    if (attempt.is_correct) entry.correct += 1;
    byConcept.set(attempt.concept, entry);
  }
  const result: Record<string, number> = {};
  for (const [concept, { correct, total }] of byConcept) {
    result[concept] = Math.round((correct / total) * 100);
  }
  return result;
}

/** Share of each concept's attempts that were COULD_IMPROVE (0-1) — a
 * near miss counted as correct above, but worth showing on its own
 * (Phase B, docs/APP_PERFECTION_PLAN.md). Null verdict (pre-Phase-B
 * attempts) never counts: those rows are binary, with nothing to recover. */
export function getCouldImproveByConcept(
  attempts: { concept: string; verdict: Verdict3 | null }[],
): Record<string, number> {
  const byConcept = new Map<string, { couldImprove: number; total: number }>();
  for (const attempt of attempts) {
    const entry = byConcept.get(attempt.concept) ?? { couldImprove: 0, total: 0 };
    entry.total += 1;
    if (attempt.verdict === "could_improve") entry.couldImprove += 1;
    byConcept.set(attempt.concept, entry);
  }
  const result: Record<string, number> = {};
  for (const [concept, { couldImprove, total }] of byConcept) {
    result[concept] = couldImprove / total;
  }
  return result;
}
