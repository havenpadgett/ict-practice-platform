import type {
  Candle,
  ChoiceExercise,
  FreeTradeExercise,
  GuidedExercise,
  LevelExercise,
  ZoneExercise,
} from "@/data/exercises";
import type { DbAttempt } from "@/lib/attempts";

export function candles(n: number, base = 100): Candle[] {
  return Array.from({ length: n }, (_, i) => ({
    time: `09:${String(30 + i).padStart(2, "0")}`,
    open: base + i,
    high: base + i + 2,
    low: base + i - 2,
    close: base + i + 1,
  }));
}

export const zone = (hasAnswer = true): ZoneExercise => ({
  exercise_id: "t-zone",
  concept: "FVG",
  answer_type: "zone",
  answerLabel: "Fair Value Gap",
  prompt: "p",
  noAnswerLabel: "No FVG present",
  instrument: "test",
  timeframe: "5m",
  difficulty: 1,
  has_answer: hasAnswer,
  answer: hasAnswer
    ? { type: "bullish", price_low: 100, price_high: 120, candle_start: 9, candle_end: 11, key_candle_index: 10 }
    : null,
  explanation: "why",
  distractor_note: hasAnswer ? undefined : "near miss",
  candles: candles(30),
});

export const level = (hasAnswer = true): LevelExercise => ({
  exercise_id: "t-level",
  concept: "Liquidity",
  answer_type: "level",
  answerLabel: "Buy-Side Liquidity",
  prompt: "p",
  noAnswerLabel: "No level",
  instrument: "test",
  timeframe: "5m",
  difficulty: 2,
  has_answer: hasAnswer,
  answer: hasAnswer ? { type: "buy_side", price: 21000, tolerance: 6 } : null,
  explanation: "why",
  distractor_note: hasAnswer ? undefined : "near miss",
  candles: candles(30),
});

export const choice = (): ChoiceExercise => ({
  exercise_id: "t-choice",
  concept: "PremiumDiscount",
  answer_type: "choice",
  answerLabel: "Premium vs. Discount",
  prompt: "p",
  options: [
    { value: "premium", label: "Premium" },
    { value: "discount", label: "Discount" },
  ],
  instrument: "test",
  timeframe: "5m",
  difficulty: 1,
  answer: { correct_choice: "discount" },
  explanation: "why",
  candles: candles(30),
});

/** Valid long: entry 110, stop 100, target 140 (3:1). The candles after the
 * setup run straight through the stop — the trade would have lost. */
export const guided = (valid = true): GuidedExercise => ({
  exercise_id: "t-guided",
  concept: "GuidedEntry",
  answer_type: "guided",
  answerLabel: "a valid trade setup",
  prompt: "p",
  instrument: "test",
  timeframe: "5m",
  difficulty: 2,
  explanation: "overall",
  answer: {
    bias: valid ? "bullish" : "unclear",
    entry: valid ? { price: 110, tolerance: 3 } : null,
    stop: valid ? { price: 100, tolerance: 3 } : null,
    target: valid ? { price: 140, tolerance: 3 } : null,
    min_rr: 2,
    is_valid_setup: valid,
    step_explanations: { bias: "b", entry: "e", stop: "s", target: "t" },
    overall_explanation: "overall",
  },
  candles: [...candles(20, 105), ...candles(10, 90).map((c) => ({ ...c, low: c.low - 20 }))],
});

export const freeTrade = (valid = true): FreeTradeExercise => ({
  exercise_id: "t-free",
  concept: "FreeTrade",
  answer_type: "free",
  title: "t",
  answerLabel: "t",
  prompt: "p",
  instrument: "test",
  timeframe: "5m",
  difficulty: 2,
  explanation: "why",
  answer: {
    intended_bias: valid ? "long" : "none",
    is_valid_setup: valid,
    entry_zone: valid ? { price_low: 105, price_high: 115, earliest_index: 5 } : null,
    stop_zone: valid ? { price_low: 95, price_high: 100 } : null,
    target: valid ? 140 : null,
    min_rr: 2,
  },
  candles: candles(10),
  hidden_candles: candles(10, 110),
});

let seq = 0;
export function attempt(concept: string, isCorrect: boolean, extra: Partial<DbAttempt> = {}): DbAttempt {
  seq += 1;
  return {
    id: `a${seq}`,
    user_id: "u",
    exercise_id: "x",
    concept,
    difficulty: 1,
    answer_type: "zone",
    user_answer_type: "region",
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
    free_direction: null,
    free_entry_price: null,
    free_stop_price: null,
    free_target_price: null,
    free_entry_candle_index: null,
    free_exit_candle_index: null,
    free_exit_price: null,
    free_exit_reason: null,
    free_rr: null,
    free_result_r: null,
    free_outcome: null,
    free_direction_correct: null,
    free_entry_correct: null,
    free_stop_correct: null,
    free_rr_correct: null,
    free_decision_correct: null,
    is_correct: isCorrect,
    failure_reason: null,
    response_time_ms: 1000,
    attempt_number: 1,
    created_at: new Date(Date.UTC(2026, 8, 1) + seq * 60000).toISOString(),
    ...extra,
  };
}
