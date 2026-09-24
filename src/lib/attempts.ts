// Supabase-backed attempt recording and dashboard aggregates. Exercise
// content stays in code (src/data/exercises.ts) — this only ever touches
// the `attempts` table, which holds nothing but what a specific user did.

import { getExercise } from "@/data/exercises";
import { createClient } from "@/lib/supabase/client";
import type { StoredAttempt } from "@/lib/storage";

/** Matches the `attempts` table (supabase/migrations/...create_profiles_and_attempts.sql,
 * widened for Guided Entry by ..._add_guided_fields_to_attempts.sql and for
 * Free Trade by ..._add_free_trade_fields_to_attempts.sql). */
export type DbAttempt = {
  id: string;
  user_id: string;
  exercise_id: string;
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
  // reached and graded wrong (that's `false`).
  guided_bias_choice: "bullish" | "bearish" | "unclear" | null;
  guided_entry_price: number | null;
  guided_stop_price: number | null;
  guided_target_price: number | null;
  guided_bias_correct: boolean | null;
  guided_entry_correct: boolean | null;
  guided_stop_correct: boolean | null;
  guided_target_correct: boolean | null;
  guided_achieved_rr: number | null;
  /** Whether the user confirmed all four steps as a trade ("Submit Setup")
   * rather than bailing with "No Trade" at some point. */
  guided_declared_trade: boolean | null;
  // Free Trade fields — populated only when answer_type = 'free'. Price,
  // R, and exit fields are null when the user finished with No Trade; each
  // free_*_correct process check is null when it didn't apply (e.g. entry
  // on a no-trade decision), not false. is_correct holds the overall
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
  is_correct: boolean;
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
} satisfies Partial<NewAttempt>;

export async function fetchAttempts(userId: string): Promise<DbAttempt[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("attempts")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
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

export async function insertAttempt(
  userId: string,
  attempt: NewAttempt,
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("attempts")
    .insert({ ...attempt, user_id: userId });
  if (error) throw error;
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
    const exercise = getExercise(a.exercise_id);
    return {
      user_id: userId,
      exercise_id: a.exercise_id,
      concept: a.concept,
      difficulty: exercise?.difficulty ?? null,
      answer_type: exercise?.answer_type ?? "zone",
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
      guided_achieved_rr: null,
      guided_declared_trade: null,
      ...NULL_FREE_TRADE_FIELDS,
      is_correct: a.is_correct,
      failure_reason: a.failure_reason,
      response_time_ms: a.response_time_ms,
      attempt_number: a.attempt_number,
    };
  });

  const supabase = createClient();
  const { error } = await supabase.from("attempts").insert(rows);
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
