"use server";

// Review Mistakes (src/app/mistakes/page.tsx). Answer keys only ever leave
// the server alongside a verdict (docs/ANSWER-KEYS.md); here the verdict is
// the user's own recorded incorrect attempt, so the key and explanation go
// back only for exercises this user has already answered wrong. The
// attempts are read with the user's own session, so RLS scopes them.

import { getExercise, isPracticeReady } from "@/data/exercises";
import { getConceptMeta } from "@/lib/concepts";
import { describeAnswer, describeCorrect, type MistakeAttemptRow } from "@/lib/mistake-text";
import { summarizeMistakes, type MistakeStatus } from "@/lib/mistakes";
import { createClient } from "@/lib/supabase/server";

export type MistakeItem = {
  exercise_id: string;
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
].join(",");

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
  const rows = (data ?? []) as unknown as MistakeAttemptRow[];

  const items: MistakeItem[] = [];
  for (const m of summarizeMistakes(rows)) {
    const e = getExercise(m.exercise_id);
    if (!e) continue;
    const lastMiss = rows.filter((r) => r.exercise_id === m.exercise_id && !r.is_correct).at(-1)!;
    items.push({
      exercise_id: m.exercise_id,
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
    });
  }
  return { ok: true, items };
}
