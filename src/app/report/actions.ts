"use server";

// Files a "Report a problem" against an exercise (question_reports,
// supabase/migrations/20260927150000_question_reports.sql). The row is
// written with the user's own session, so RLS makes it theirs. The exercise
// id comes from the exercise on screen; the server checks it exists.

import { getExercise } from "@/data/exercises";
import { isReportReason, REPORT_NOTE_MAX, type ReportReason, type ReportStage } from "@/lib/report-reasons";
import { createClient } from "@/lib/supabase/server";

export type ReportInput = {
  exerciseId: string;
  reason: ReportReason;
  note: string;
  stage: ReportStage;
  sessionId: string | null;
};

export async function reportQuestion(input: ReportInput): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Your login has expired. Log in again to report this." };

  const x = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
  if (typeof x.exerciseId !== "string" || !getExercise(x.exerciseId)) return { ok: false, error: "That exercise couldn't be found." };
  if (!isReportReason(x.reason)) return { ok: false, error: "Pick a reason." };
  if (x.stage !== "exercise" && x.stage !== "feedback") return { ok: false, error: "That report couldn't be read. Try again." };
  const note = typeof x.note === "string" ? x.note.trim().slice(0, REPORT_NOTE_MAX) : "";
  if (x.reason === "other" && note.length === 0) return { ok: false, error: "Add a note saying what's wrong." };

  const { error } = await supabase.from("question_reports").insert({
    exercise_id: x.exerciseId,
    reason: x.reason,
    note: note || null,
    stage: x.stage,
    session_id: typeof x.sessionId === "string" ? x.sessionId.slice(0, 100) : null,
  });
  if (error) {
    // 42P01 / PGRST205: the table doesn't exist yet (migration not applied).
    if (error.code === "42P01" || error.code === "PGRST205") {
      return { ok: false, error: "Reporting isn't available yet. Please try again later." };
    }
    return { ok: false, error: "Your report couldn't be sent. Try again." };
  }
  return { ok: true };
}
