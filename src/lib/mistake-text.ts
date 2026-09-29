// Plain-language text for Review Mistakes (src/app/mistakes/actions.ts):
// what the user answered, read back from their attempt row, and what the
// correct answer was, from the exercise's key. Server-only in practice:
// the only caller holds the full exercise.

import type { Exercise } from "@/data/exercises";
import type { DbAttempt } from "@/lib/attempts";
import { buildCorrectAnswerStatement, formatPrice } from "@/lib/grading";
import { protectiveStopBand } from "@/lib/verdict";

export type MistakeAttemptRow = Pick<
  DbAttempt,
  | "exercise_id" | "is_correct" | "created_at" | "user_answer_type" | "user_price_low" | "user_price_high" | "user_price"
  | "user_choice" | "guided_bias_choice" | "guided_entry_price" | "guided_stop_price" | "guided_target_price"
  | "guided_declared_trade" | "free_direction" | "free_entry_price" | "free_stop_price" | "free_target_price"
  | "free_exit_price" | "free_exit_reason"
>;

const p = (x: number | null) => (x === null ? "—" : formatPrice(x));
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function describeAnswer(e: Exercise, a: MistakeAttemptRow): string {
  switch (a.user_answer_type) {
    case "none":
      return "noAnswerLabel" in e ? e.noAnswerLabel : "No answer";
    case "region":
      return `A box from ${p(a.user_price_low)} to ${p(a.user_price_high)}`;
    case "level":
      return `A line at ${p(a.user_price)}`;
    case "choice": {
      const opt = e.answer_type === "choice" ? e.options.find((o) => o.value === a.user_choice) : undefined;
      return opt?.label ?? a.user_choice ?? "—";
    }
    case "guided": {
      const bias = a.guided_bias_choice ? cap(a.guided_bias_choice) : "—";
      if (!a.guided_declared_trade) {
        const placed = [a.guided_entry_price !== null && `entry ${p(a.guided_entry_price)}`, a.guided_stop_price !== null && `stop ${p(a.guided_stop_price)}`]
          .filter(Boolean)
          .join(", ");
        return `${bias} bias, then No Trade${placed ? ` (after ${placed})` : ""}`;
      }
      return `${bias} bias: entry ${p(a.guided_entry_price)}, stop ${p(a.guided_stop_price)}, target ${p(a.guided_target_price)}`;
    }
    case "free": {
      if (!a.free_direction || a.free_direction === "none") return "No Trade";
      const exit =
        a.free_exit_reason === "session_end" ? "held to the end of the session" : a.free_exit_reason ? `exited at the ${a.free_exit_reason}` : "still open";
      return `${cap(a.free_direction)} at ${p(a.free_entry_price)}, stop ${p(a.free_stop_price)}, target ${p(a.free_target_price)}; ${exit}`;
    }
  }
}

export function describeCorrect(e: Exercise): { correctAnswer: string; explanation: string } {
  switch (e.answer_type) {
    case "zone":
    case "level":
    case "choice": {
      const statement = buildCorrectAnswerStatement(e).replace(/^The correct answer was: /, "");
      const noAnswer = e.answer_type !== "choice" && !e.has_answer;
      return { correctAnswer: cap(statement), explanation: noAnswer ? (e.distractor_note ?? e.explanation) : e.explanation };
    }
    case "guided": {
      const a = e.answer;
      const correctAnswer = a.is_valid_setup
        ? `${cap(a.bias)} bias: entry ${p(a.entry?.anchor ?? null)}, stop ${p(a.stop?.invalidation_price ?? null)}, target ${p(a.target?.anchor ?? null)}`
        : a.bias === "unclear"
          ? "No Trade: the bias is unclear"
          : `${cap(a.bias)} bias, but No Trade`;
      return { correctAnswer, explanation: a.overall_explanation };
    }
    case "free": {
      const a = e.answer;
      const stopBand = a.stop_zone && a.intended_bias !== "none" ? protectiveStopBand(a.stop_zone, a.intended_bias) : null;
      const correctAnswer =
        a.is_valid_setup && a.intended_bias !== "none" && a.entry_zone && stopBand
          ? `${cap(a.intended_bias)}: enter ${p(a.entry_zone.price_low)}–${p(a.entry_zone.price_high)}, stop ${p(stopBand.price_low)}–${p(stopBand.price_high)}, target ${p(a.target?.anchor ?? null)}`
          : "No Trade";
      return { correctAnswer, explanation: e.explanation };
    }
  }
}

