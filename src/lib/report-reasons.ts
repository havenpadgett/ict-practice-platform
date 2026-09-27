// Reasons a user can report an exercise for ("Report a problem",
// src/components/practice/report-question.tsx). Values match the check
// constraint in supabase/migrations/20260927150000_question_reports.sql.

export const REPORT_REASONS = [
  { value: "answer_wrong", label: "The answer looks wrong" },
  { value: "chart_unclear", label: "The chart is unclear" },
  { value: "ambiguous", label: "More than one answer could be right" },
  { value: "technical", label: "Something isn't working" },
  { value: "other", label: "Something else" },
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number]["value"];

/** Where the report was made: while answering, or from the feedback. */
export type ReportStage = "exercise" | "feedback";

export const REPORT_NOTE_MAX = 1000;

export function isReportReason(x: unknown): x is ReportReason {
  return REPORT_REASONS.some((r) => r.value === x);
}

export function reasonLabel(value: string): string {
  return REPORT_REASONS.find((r) => r.value === value)?.label ?? value;
}
