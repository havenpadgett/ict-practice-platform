// Short names for what went wrong on a missed answer (attempts.failure_reason),
// shared by the session summary and Review Mistakes.

export const FAILURE_LABELS: Record<string, string> = {
  coverage: "Box in the wrong place",
  too_small: "Box too small",
  precision: "Box too wide",
  time: "Wrong candles",
  off_level: "Line outside tolerance",
  wrong_choice: "Wrong choice",
  missed_answer: "Missed a setup that was there",
  false_positive: "Marked a setup that wasn't there",
};

/** The label for a failure reason; Guided Entry and Free Trade record none,
 * so their misses read as a trade-plan problem. */
export function failureLabel(reason: string | null, answerType?: string): string | null {
  if (reason && FAILURE_LABELS[reason]) return FAILURE_LABELS[reason];
  if (answerType === "guided" || answerType === "free") return "Trade plan";
  return null;
}
