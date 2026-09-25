// Builds the row written to the `attempts` table for each kind of answer.
// Pure (no Supabase, no React) so what gets recorded can be tested against
// PRD Section 9 without a browser or a database.

import type { Exercise, FreeTradeExercise, GuidedExercise } from "@/data/exercises";
import { NULL_FREE_TRADE_FIELDS, type NewAttempt } from "@/lib/attempts";
import type { FreeTradeExit, FreeTradeGradeResult, FreeTradePosition } from "@/lib/free-trade-grading";
import type { GradeResult, UserAnswer } from "@/lib/grading";
import type { GuidedGradeResult, GuidedUserAnswer } from "@/lib/guided-grading";

export type AttemptMeta = { responseTimeMs: number; attemptNumber: number };

const NULL_GUIDED_FIELDS = {
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
} satisfies Partial<NewAttempt>;

const NULL_ANSWER_FIELDS = {
  user_price_low: null,
  user_price_high: null,
  user_candle_start: null,
  user_candle_end: null,
  coverage: null,
  precision_ratio: null,
  user_price: null,
  distance_from_level: null,
  user_choice: null,
  correct_choice: null,
} satisfies Partial<NewAttempt>;

/** Zone, level and choice answers (Mode 1). */
export function buildAnswerAttempt(exercise: Exercise, answer: UserAnswer, grade: GradeResult, meta: AttemptMeta): NewAttempt {
  const isRegion = answer.type === "region";
  return {
    exercise_id: exercise.exercise_id,
    concept: exercise.concept,
    difficulty: exercise.difficulty,
    answer_type: exercise.answer_type,
    user_answer_type: answer.type,
    user_price_low: isRegion ? answer.region.priceLow : null,
    user_price_high: isRegion ? answer.region.priceHigh : null,
    user_candle_start: isRegion ? answer.region.candleIndexLow : null,
    user_candle_end: isRegion ? answer.region.candleIndexHigh : null,
    user_price: answer.type === "level" ? answer.price : null,
    distance_from_level: grade.distanceFromLevel,
    user_choice: answer.type === "choice" ? answer.choice : null,
    correct_choice: exercise.answer_type === "choice" ? exercise.answer.correct_choice : null,
    ...NULL_GUIDED_FIELDS,
    ...NULL_FREE_TRADE_FIELDS,
    is_correct: grade.isCorrect,
    coverage: grade.coverage,
    precision_ratio: grade.precisionRatio,
    failure_reason: grade.failureReason,
    response_time_ms: meta.responseTimeMs,
    attempt_number: meta.attemptNumber,
  };
}

export function buildGuidedAttempt(
  exercise: GuidedExercise,
  answer: GuidedUserAnswer,
  grade: GuidedGradeResult,
  meta: AttemptMeta,
): NewAttempt {
  const stepResult = (step: "bias" | "entry" | "stop" | "target") =>
    grade.steps.find((s) => s.step === step)?.isCorrect ?? null;
  return {
    exercise_id: exercise.exercise_id,
    concept: exercise.concept,
    difficulty: exercise.difficulty,
    answer_type: "guided",
    user_answer_type: "guided",
    ...NULL_ANSWER_FIELDS,
    guided_bias_choice: answer.bias,
    guided_entry_price: answer.entry,
    guided_stop_price: answer.stop,
    guided_target_price: answer.target,
    guided_bias_correct: stepResult("bias"),
    guided_entry_correct: stepResult("entry"),
    guided_stop_correct: stepResult("stop"),
    guided_target_correct: stepResult("target"),
    guided_achieved_rr: grade.achievedRR,
    guided_declared_trade: answer.declaredTrade,
    ...NULL_FREE_TRADE_FIELDS,
    is_correct: grade.isCorrect,
    failure_reason: null,
    response_time_ms: meta.responseTimeMs,
    attempt_number: meta.attemptNumber,
  };
}

/** is_correct is the process verdict, never the win/loss outcome. */
export function buildFreeTradeAttempt(
  exercise: FreeTradeExercise,
  position: FreeTradePosition | null,
  exit: FreeTradeExit | null,
  grade: FreeTradeGradeResult,
  meta: AttemptMeta,
): NewAttempt {
  const checkResult = (id: FreeTradeGradeResult["checks"][number]["id"]) => {
    const status = grade.checks.find((c) => c.id === id)?.status;
    return status === "pass" ? true : status === "fail" ? false : null;
  };
  return {
    exercise_id: exercise.exercise_id,
    concept: exercise.concept,
    difficulty: exercise.difficulty,
    answer_type: "free",
    user_answer_type: "free",
    ...NULL_ANSWER_FIELDS,
    ...NULL_GUIDED_FIELDS,
    free_direction: position?.direction ?? "none",
    free_entry_price: position?.entry ?? null,
    free_stop_price: position?.stop ?? null,
    free_target_price: position?.target ?? null,
    free_entry_candle_index: position?.entryIndex ?? null,
    free_exit_candle_index: exit?.index ?? null,
    free_exit_price: exit?.price ?? null,
    free_exit_reason: exit?.reason ?? null,
    free_rr: grade.rr,
    free_result_r: grade.resultR,
    free_outcome: grade.outcome,
    free_direction_correct: checkResult("direction"),
    free_entry_correct: checkResult("entry"),
    free_stop_correct: checkResult("stop"),
    free_rr_correct: checkResult("rr"),
    free_decision_correct: checkResult("decision"),
    is_correct: grade.passed,
    failure_reason: null,
    response_time_ms: meta.responseTimeMs,
    attempt_number: meta.attemptNumber,
  };
}
