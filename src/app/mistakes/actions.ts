"use server";

// Review Mistakes (src/app/mistakes/page.tsx). Answer keys only ever leave
// the server alongside a verdict (docs/ANSWER-KEYS.md); here the verdict is
// the user's own recorded incorrect attempt, so the key and explanation go
// back only for exercises this user has already answered wrong. The
// attempts are read with the user's own session, so RLS scopes them.

import { getExercise, isPracticeReady, type Candle, type DealingRange, type Exercise } from "@/data/exercises";
import type { DbAttempt } from "@/lib/attempts";
import { getConceptMeta } from "@/lib/concepts";
import { describeAnswer, describeCorrect, type MistakeAttemptRow } from "@/lib/mistake-text";
import { summarizeMistakes, type MistakeStatus } from "@/lib/mistakes";
import { createClient } from "@/lib/supabase/server";

/** What to draw for a mistake: the chart as stored (never the framed
 * window a session showed, since recorded answers use stored indices),
 * the user's last wrong answer, and the correct one. */
export type ReviewChart =
  | {
      kind: "zone";
      candles: Candle[];
      user: { low: number; high: number; start: number; end: number } | null;
      correct: { price_low: number; price_high: number; candle_start: number; candle_end: number } | null;
    }
  | { kind: "level"; candles: Candle[]; user: number | null; correct: number | null }
  | {
      kind: "choice";
      candles: Candle[];
      fvgZone: { price_low: number; price_high: number; candle_start: number; candle_end: number } | null;
      dealingRange: DealingRange | null;
    }
  | {
      kind: "guided";
      candles: Candle[];
      user: { entry: number | null; stop: number | null; target: number | null };
      correct: { entry: number | null; stop: number | null; target: number | null };
    }
  | {
      kind: "free";
      candles: Candle[];
      user: {
        entry: number | null;
        stop: number | null;
        target: number | null;
        entryIndex: number | null;
        exit: { index: number; price: number } | null;
      };
      ideal: {
        entryZone: { price_low: number; price_high: number; candle_start: number } | null;
        stopZone: { price_low: number; price_high: number } | null;
        target: number | null;
      };
    };

export type MistakeItem = {
  exercise_id: string;
  concept: string;
  conceptLabel: string;
  answerLabel: string;
  difficulty: 1 | 2 | 3;
  status: MistakeStatus;
  missed: number;
  lastMissedAt: string;
  clearedAt: string | null;
  /** What the user answered on their most recent miss. */
  yourAnswer: string;
  correctAnswer: string;
  explanation: string;
  /** Still servable in practice, so it can be retried. */
  retryable: boolean;
  /** attempts.failure_reason of the most recent miss. */
  failureReason: string | null;
  answerType: Exercise["answer_type"];
  chart: ReviewChart;
};

const COLUMNS = [
  "exercise_id",
  "is_correct",
  "created_at",
  "user_answer_type",
  "user_price_low",
  "user_price_high",
  "user_price",
  "user_choice",
  "guided_bias_choice",
  "guided_entry_price",
  "guided_stop_price",
  "guided_target_price",
  "guided_declared_trade",
  "free_direction",
  "free_entry_price",
  "free_stop_price",
  "free_target_price",
  "free_exit_price",
  "free_exit_reason",
  "user_candle_start",
  "user_candle_end",
  "free_entry_candle_index",
  "free_exit_candle_index",
  "failure_reason",
].join(",");

type Row = MistakeAttemptRow &
  Pick<DbAttempt, "user_candle_start" | "user_candle_end" | "free_entry_candle_index" | "free_exit_candle_index" | "failure_reason">;

function reviewChart(e: Exercise, a: Row): ReviewChart {
  switch (e.answer_type) {
    case "zone":
      return {
        kind: "zone",
        candles: e.candles,
        user:
          a.user_answer_type === "region" && a.user_price_low !== null && a.user_price_high !== null && a.user_candle_start !== null && a.user_candle_end !== null
            ? { low: a.user_price_low, high: a.user_price_high, start: a.user_candle_start, end: a.user_candle_end }
            : null,
        correct: e.has_answer && e.answer ? e.answer : null,
      };
    case "level":
      return {
        kind: "level",
        candles: e.candles,
        user: a.user_answer_type === "level" ? a.user_price : null,
        correct: e.has_answer && e.answer ? e.answer.price : null,
      };
    case "choice":
      return { kind: "choice", candles: e.candles, fvgZone: e.answer.fvg_zone ?? null, dealingRange: e.answer.dealing_range ?? null };
    case "guided":
      return {
        kind: "guided",
        candles: e.candles,
        user: { entry: a.guided_entry_price, stop: a.guided_stop_price, target: a.guided_target_price },
        correct: { entry: e.answer.entry?.price ?? null, stop: e.answer.stop?.price ?? null, target: e.answer.target?.price ?? null },
      };
    case "free":
      return {
        kind: "free",
        candles: [...e.candles, ...e.hidden_candles],
        user: {
          entry: a.free_entry_price,
          stop: a.free_stop_price,
          target: a.free_target_price,
          entryIndex: a.free_entry_candle_index,
          exit: a.free_exit_candle_index !== null && a.free_exit_price !== null ? { index: a.free_exit_candle_index, price: a.free_exit_price } : null,
        },
        ideal: {
          entryZone: e.answer.entry_zone
            ? { price_low: e.answer.entry_zone.price_low, price_high: e.answer.entry_zone.price_high, candle_start: e.answer.entry_zone.earliest_index }
            : null,
          stopZone: e.answer.stop_zone,
          target: e.answer.target,
        },
      };
  }
}

export async function loadMistakes(): Promise<{ ok: true; items: MistakeItem[] } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Your login has expired. Log in again to continue." };
  const { data, error } = await supabase
    .from("attempts")
    .select(COLUMNS)
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });
  if (error) return { ok: false, error: "Your mistakes couldn't be loaded. Try again." };
  const rows = (data ?? []) as unknown as Row[];

  const items: MistakeItem[] = [];
  for (const m of summarizeMistakes(rows)) {
    const e = getExercise(m.exercise_id);
    if (!e) continue;
    const lastMiss = rows.filter((r) => r.exercise_id === m.exercise_id && !r.is_correct).at(-1)!;
    items.push({
      exercise_id: m.exercise_id,
      concept: e.concept,
      conceptLabel: getConceptMeta(e.concept).pickerLabel,
      answerLabel: e.answer_type === "free" ? e.title : e.answerLabel,
      difficulty: e.difficulty,
      status: m.status,
      missed: m.missed,
      lastMissedAt: m.lastMissedAt,
      clearedAt: m.clearedAt,
      yourAnswer: describeAnswer(e, lastMiss),
      ...describeCorrect(e),
      retryable: isPracticeReady(e),
      failureReason: lastMiss.failure_reason,
      answerType: e.answer_type,
      chart: reviewChart(e, lastMiss),
    });
  }
  return { ok: true, items };
}
