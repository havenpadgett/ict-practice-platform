// Builds the row written to the `attempts` table for each kind of answer.
// Pure (no Supabase, no React) so what gets recorded can be tested against
// PRD Section 9 without a browser or a database.

import type { Exercise, FreeTradeExercise, GuidedExercise } from "@/data/exercises";
import { NULL_FREE_TRADE_FIELDS, type NewAttempt } from "@/lib/attempts";
import type { FreeTradeExit, FreeTradeGradeResult, FreeTradePosition } from "@/lib/free-trade-grading";
import type { GradeResult, UserAnswer } from "@/lib/grading";
import type { GuidedGradeResult, GuidedStepId, GuidedUserAnswer } from "@/lib/guided-grading";
import { isCorrectForCompat } from "@/lib/verdict";

export type AttemptMeta = { sessionId: string; responseTimeMs: number; attemptNumber: number };

const NULL_GUIDED_FIELDS = {
  guided_bias_choice: null,
  guided_entry_price: null,
  guided_stop_price: null,
  guided_target_price: null,
  guided_bias_correct: null,
  guided_entry_correct: null,
  guided_stop_correct: null,
  guided_target_correct: null,
  guided_bias_verdict: null,
  guided_entry_verdict: null,
  guided_stop_verdict: null,
  guided_target_verdict: null,
  guided_rr_verdict: null,
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
    session_id: meta.sessionId,
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
    verdict: grade.verdict,
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
  const stepVerdict = (step: GuidedStepId) => grade.steps.find((s) => s.step === step)?.verdict ?? null;
  const bias = stepVerdict("bias");
  const entry = stepVerdict("entry");
  const stop = stepVerdict("stop");
  const target = stepVerdict("target");
  return {
    exercise_id: exercise.exercise_id,
    session_id: meta.sessionId,
    concept: exercise.concept,
    difficulty: exercise.difficulty,
    answer_type: "guided",
    user_answer_type: "guided",
    ...NULL_ANSWER_FIELDS,
    guided_bias_choice: answer.bias,
    guided_entry_price: answer.entry,
    guided_stop_price: answer.stop,
    guided_target_price: answer.target,
    guided_bias_correct: bias === null ? null : isCorrectForCompat(bias),
    guided_entry_correct: entry === null ? null : isCorrectForCompat(entry),
    guided_stop_correct: stop === null ? null : isCorrectForCompat(stop),
    guided_target_correct: target === null ? null : isCorrectForCompat(target),
    guided_bias_verdict: bias,
    guided_entry_verdict: entry,
    guided_stop_verdict: stop,
    guided_target_verdict: target,
    guided_rr_verdict: grade.rrVerdict,
    guided_achieved_rr: grade.achievedRR,
    guided_declared_trade: answer.declaredTrade,
    ...NULL_FREE_TRADE_FIELDS,
    is_correct: grade.isCorrect,
    verdict: grade.verdict,
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
  const checkVerdict = (id: FreeTradeGradeResult["checks"][number]["id"]) =>
    grade.checks.find((c) => c.id === id)?.verdict ?? null;
  const direction = checkVerdict("direction");
  const entryV = checkVerdict("entry");
  const stopV = checkVerdict("stop");
  const targetV = checkVerdict("target");
  const rrV = checkVerdict("rr");
  const decisionV = checkVerdict("decision");
  return {
    exercise_id: exercise.exercise_id,
    session_id: meta.sessionId,
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
    free_direction_correct: direction === null ? null : isCorrectForCompat(direction),
    free_entry_correct: entryV === null ? null : isCorrectForCompat(entryV),
    free_stop_correct: stopV === null ? null : isCorrectForCompat(stopV),
    free_rr_correct: rrV === null ? null : isCorrectForCompat(rrV),
    free_decision_correct: decisionV === null ? null : isCorrectForCompat(decisionV),
    free_direction_verdict: direction,
    free_entry_verdict: entryV,
    free_stop_verdict: stopV,
    free_target_verdict: targetV,
    free_rr_verdict: rrV,
    free_decision_verdict: decisionV,
    is_correct: grade.passed,
    verdict: grade.verdict,
    failure_reason: null,
    response_time_ms: meta.responseTimeMs,
    attempt_number: meta.attemptNumber,
  };
}
