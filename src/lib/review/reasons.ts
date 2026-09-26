// Structured rejection reasons, so rejection patterns per rule can be
// counted (docs/SCENARIO-VALIDATION.md → Rejection Summary) instead of
// buried in free text. Order = keyboard shortcut 1–5 on /review.

export const REJECTION_REASONS = {
  wrong_answer_key: "Wrong answer key",
  ambiguous: "Ambiguous",
  poor_chart: "Poor quality chart",
  not_definition: "Doesn't match the definition",
  other: "Other",
} as const;

export type RejectionReason = keyof typeof REJECTION_REASONS;

export function isRejectionReason(value: string): value is RejectionReason {
  return value in REJECTION_REASONS;
}
