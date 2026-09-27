// What the browser gets to see of an exercise before it's answered
// (docs/ANSWER-KEYS.md): the chart, the prompt and the controls — never
// the answer key, the explanation, the near-miss note or provenance. The
// server builds these (src/app/practice/actions.ts); grading happens there
// too, and the key comes back only with the verdict.

import type { Candle, ChoiceAnswer, ChoiceOption, Exercise } from "@/data/exercises";
import type { Concept } from "@/lib/concepts";
import type { Frame } from "@/lib/framing";

type PublicBase = {
  exercise_id: string;
  concept: Concept;
  difficulty: 1 | 2 | 3;
  timeframe: string;
  prompt: string;
  candles: Candle[];
  /** A real-data scenario: Free Trade hides its dates during playback. */
  real: boolean;
};

export type PublicZoneExercise = PublicBase & { answer_type: "zone"; noAnswerLabel: string };
export type PublicLevelExercise = PublicBase & { answer_type: "level"; noAnswerLabel: string };
export type PublicChoiceExercise = PublicBase & {
  answer_type: "choice";
  options: ChoiceOption[];
  /** Shown from the start: the question is what price did after it, not
   * where it is (see ChoiceAnswer in src/data/exercises.ts). */
  fvg_zone: ChoiceAnswer["fvg_zone"] | null;
  dealing_range: ChoiceAnswer["dealing_range"] | null;
};
export type PublicGuidedExercise = PublicBase & { answer_type: "guided"; min_rr: number };
export type PublicFreeTradeExercise = PublicBase & {
  answer_type: "free";
  title: string;
  /** Known limitation: playback needs these in the browser (docs/ANSWER-KEYS.md). */
  hidden_candles: Candle[];
  min_rr: number;
};

export type PublicExercise = PublicZoneExercise | PublicLevelExercise | PublicChoiceExercise | PublicGuidedExercise | PublicFreeTradeExercise;

/** `frame` is the slice of candles to show (src/lib/framing.ts); candle
 * indices sent along with the chart are moved into it. Omitted = whole. */
export function toPublicExercise(e: Exercise, frame?: Frame): PublicExercise {
  const whole = !frame || (frame.start === 0 && frame.end === e.candles.length - 1);
  const shift = whole ? 0 : frame.start;
  const base: PublicBase = {
    exercise_id: e.exercise_id,
    concept: e.concept,
    difficulty: e.difficulty,
    timeframe: e.timeframe,
    prompt: e.prompt,
    candles: whole ? e.candles : e.candles.slice(frame.start, frame.end + 1),
    real: e.provenance !== undefined,
  };
  switch (e.answer_type) {
    case "zone":
      return { ...base, answer_type: "zone", noAnswerLabel: e.noAnswerLabel };
    case "level":
      return { ...base, answer_type: "level", noAnswerLabel: e.noAnswerLabel };
    case "choice":
      return {
        ...base,
        answer_type: "choice",
        options: e.options,
        fvg_zone: e.answer.fvg_zone
          ? { ...e.answer.fvg_zone, candle_start: e.answer.fvg_zone.candle_start - shift, candle_end: e.answer.fvg_zone.candle_end - shift }
          : null,
        dealing_range: e.answer.dealing_range
          ? { ...e.answer.dealing_range, high_index: e.answer.dealing_range.high_index - shift, low_index: e.answer.dealing_range.low_index - shift }
          : null,
      };
    case "guided":
      return { ...base, answer_type: "guided", min_rr: e.answer.min_rr };
    case "free":
      return { ...base, answer_type: "free", title: e.title, hidden_candles: e.hidden_candles, min_rr: e.answer.min_rr };
  }
}
