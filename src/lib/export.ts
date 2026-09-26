// Flat CSV of attempts for external BI tools (Power BI, Excel). One row per
// attempt, every column self-contained — no joins back to exercise content
// needed. Column meanings: docs/ANALYTICS.md.

import { getExerciseMeta } from "@/data/catalog";
import type { DbAttempt } from "@/lib/attempts";
import { getConceptMeta } from "@/lib/concepts";

export type ExportUser = { id: string; email: string | null };

/** A row of the v_sessions view (supabase/migrations/20260926130000_practice_events.sql). */
export type ExportSession = {
  session_id: string;
  started_at: string;
  mode: string | null;
  concept: string | null;
  source: string | null;
  planned_length: number | null;
  completed: boolean;
  exercises_answered: number;
  ended_at: string | null;
  hours_since_previous: number | null;
};

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

export const EXPORT_COLUMNS: {
  name: string;
  value: (a: DbAttempt, u: ExportUser, s: ExportSession | undefined) => Cell;
}[] = [
  { name: "attempt_id", value: (a) => a.id },
  { name: "user_id", value: (a) => a.user_id },
  { name: "user_email", value: (_a, u) => u.email },
  { name: "session_id", value: (a) => a.session_id },
  // From practice_events via v_sessions. Blank when the session has no
  // session_started event (before tracking existed, or the migration isn't
  // applied yet).
  { name: "session_source", value: (_a, _u, s) => s?.source },
  { name: "session_planned_length", value: (_a, _u, s) => s?.planned_length },
  { name: "session_completed", value: (_a, _u, s) => (s ? flag(s.completed) : null) },
  { name: "attempted_at_utc", value: (a) => new Date(a.created_at).toISOString() },
  { name: "attempted_date_utc", value: (a) => new Date(a.created_at).toISOString().slice(0, 10) },
  { name: "exercise_id", value: (a) => a.exercise_id },
  { name: "exercise_label", value: (a) => getExerciseMeta(a.exercise_id)?.answerLabel ?? null },
  { name: "concept", value: (a) => a.concept },
  { name: "concept_label", value: (a) => getConceptMeta(a.concept).pickerLabel },
  { name: "mode", value: (a) => MODES[a.answer_type] ?? a.answer_type },
  { name: "answer_type", value: (a) => a.answer_type },
  { name: "user_answer_type", value: (a) => a.user_answer_type },
  { name: "difficulty", value: (a) => a.difficulty },
  {
    name: "data_source",
    value: (a) => {
      const e = getExerciseMeta(a.exercise_id);
      return e === undefined ? "unknown" : e.real ? "real" : "constructed";
    },
  },
  { name: "real_trading_date", value: (a) => getExerciseMeta(a.exercise_id)?.trading_date ?? null },
  { name: "timeframe", value: (a) => getExerciseMeta(a.exercise_id)?.timeframe ?? null },
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

function toCsv(header: string[], rows: Cell[][]): string {
  const lines = [header.join(","), ...rows.map((r) => r.map(csvCell).join(","))];
  return "﻿" + lines.join("\r\n") + "\r\n";
}

/** RFC 4180 CSV, CRLF line endings, UTF-8 BOM so Excel reads it as UTF-8. */
export function attemptsToCsv(attempts: DbAttempt[], user: ExportUser, sessions: ExportSession[] = []): string {
  const bySession = new Map(sessions.map((s) => [s.session_id, s]));
  return toCsv(
    EXPORT_COLUMNS.map((c) => c.name),
    attempts.map((a) => {
      const s = a.session_id ? bySession.get(a.session_id) : undefined;
      return EXPORT_COLUMNS.map((c) => c.value(a, user, s));
    }),
  );
}

export const SESSION_EXPORT_COLUMNS: { name: string; value: (s: ExportSession, u: ExportUser) => Cell }[] = [
  { name: "session_id", value: (s) => s.session_id },
  { name: "user_id", value: (_s, u) => u.id },
  { name: "user_email", value: (_s, u) => u.email },
  { name: "started_at_utc", value: (s) => new Date(s.started_at).toISOString() },
  { name: "started_date_utc", value: (s) => new Date(s.started_at).toISOString().slice(0, 10) },
  { name: "ended_at_utc", value: (s) => (s.ended_at ? new Date(s.ended_at).toISOString() : null) },
  { name: "mode", value: (s) => s.mode },
  { name: "concept", value: (s) => s.concept },
  { name: "source", value: (s) => s.source },
  { name: "planned_length", value: (s) => s.planned_length },
  { name: "exercises_answered", value: (s) => s.exercises_answered },
  { name: "completed", value: (s) => flag(s.completed) },
  { name: "hours_since_previous", value: (s) => (s.hours_since_previous === null ? null : Math.round(s.hours_since_previous * 100) / 100) },
];

/** One row per started session (v_sessions), same format as the attempts CSV. */
export function sessionsToCsv(sessions: ExportSession[], user: ExportUser): string {
  return toCsv(
    SESSION_EXPORT_COLUMNS.map((c) => c.name),
    sessions.map((s) => SESSION_EXPORT_COLUMNS.map((c) => c.value(s, user))),
  );
}
