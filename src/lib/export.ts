// Flat CSV of attempts for external BI tools (Power BI, Excel). One row per
// attempt, every column self-contained — no joins back to exercise content
// needed. Column meanings: docs/ANALYTICS.md.

import { getExercise } from "@/data/exercises";
import type { DbAttempt } from "@/lib/attempts";
import { getConceptMeta } from "@/lib/concepts";

export type ExportUser = { id: string; email: string | null };

type Cell = string | number | boolean | null | undefined;

const MODES: Record<DbAttempt["answer_type"], string> = {
  zone: "recognition",
  level: "recognition",
  choice: "recognition",
  guided: "guided_entry",
  free: "free_trade",
};

/** 1 / 0 / blank, so BI tools can average a column straight into a rate. */
function flag(value: boolean | null | undefined): Cell {
  return value === null || value === undefined ? null : value ? 1 : 0;
}

export const EXPORT_COLUMNS: { name: string; value: (a: DbAttempt, u: ExportUser) => Cell }[] = [
  { name: "attempt_id", value: (a) => a.id },
  { name: "user_id", value: (a) => a.user_id },
  { name: "user_email", value: (_a, u) => u.email },
  { name: "attempted_at_utc", value: (a) => new Date(a.created_at).toISOString() },
  { name: "attempted_date_utc", value: (a) => new Date(a.created_at).toISOString().slice(0, 10) },
  { name: "exercise_id", value: (a) => a.exercise_id },
  { name: "exercise_label", value: (a) => getExercise(a.exercise_id)?.answerLabel ?? null },
  { name: "concept", value: (a) => a.concept },
  { name: "concept_label", value: (a) => getConceptMeta(a.concept).pickerLabel },
  { name: "mode", value: (a) => MODES[a.answer_type] ?? a.answer_type },
  { name: "answer_type", value: (a) => a.answer_type },
  { name: "user_answer_type", value: (a) => a.user_answer_type },
  { name: "difficulty", value: (a) => a.difficulty },
  {
    name: "data_source",
    value: (a) => {
      const e = getExercise(a.exercise_id);
      return e === undefined ? "unknown" : e.provenance ? "real" : "constructed";
    },
  },
  { name: "real_trading_date", value: (a) => getExercise(a.exercise_id)?.provenance?.trading_date ?? null },
  { name: "timeframe", value: (a) => getExercise(a.exercise_id)?.timeframe ?? null },
  { name: "is_correct", value: (a) => flag(a.is_correct) },
  { name: "failure_reason", value: (a) => a.failure_reason },
  { name: "response_time_ms", value: (a) => a.response_time_ms },
  { name: "attempt_number", value: (a) => a.attempt_number },
  { name: "coverage", value: (a) => a.coverage },
  { name: "precision_ratio", value: (a) => a.precision_ratio },
  { name: "distance_from_level", value: (a) => a.distance_from_level },
  { name: "guided_bias_correct", value: (a) => flag(a.guided_bias_correct) },
  { name: "guided_entry_correct", value: (a) => flag(a.guided_entry_correct) },
  { name: "guided_stop_correct", value: (a) => flag(a.guided_stop_correct) },
  { name: "guided_target_correct", value: (a) => flag(a.guided_target_correct) },
  { name: "guided_declared_trade", value: (a) => flag(a.guided_declared_trade) },
  { name: "guided_achieved_rr", value: (a) => a.guided_achieved_rr },
  { name: "free_decision_correct", value: (a) => flag(a.free_decision_correct) },
  { name: "free_direction_correct", value: (a) => flag(a.free_direction_correct) },
  { name: "free_entry_correct", value: (a) => flag(a.free_entry_correct) },
  { name: "free_stop_correct", value: (a) => flag(a.free_stop_correct) },
  { name: "free_rr_correct", value: (a) => flag(a.free_rr_correct) },
  { name: "free_direction", value: (a) => a.free_direction },
  { name: "free_outcome", value: (a) => a.free_outcome },
  { name: "free_is_win", value: (a) => (a.free_outcome === "win" ? 1 : a.free_outcome === "loss" ? 0 : null) },
  { name: "free_result_r", value: (a) => a.free_result_r },
  { name: "free_planned_rr", value: (a) => a.free_rr },
];

function csvCell(value: Cell): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  return /[",\r\n]/.test(s) || /^[=+\-@\t]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** RFC 4180 CSV, CRLF line endings, UTF-8 BOM so Excel reads it as UTF-8. */
export function attemptsToCsv(attempts: DbAttempt[], user: ExportUser): string {
  const lines = [EXPORT_COLUMNS.map((c) => c.name).join(",")];
  for (const a of attempts) lines.push(EXPORT_COLUMNS.map((c) => csvCell(c.value(a, user))).join(","));
  return "﻿" + lines.join("\r\n") + "\r\n";
}
