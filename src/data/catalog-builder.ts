// Derives the lightweight exercise catalog from the full exercise data.
// Imported only by scripts/build-catalog.ts and tests — never by the app,
// which reads the generated JSON through src/data/catalog.ts.

import { exercises, isPracticeReady } from "@/data/exercises";
import type { ExerciseMeta } from "@/data/catalog";

export function buildCatalog(): ExerciseMeta[] {
  return exercises.map((e) => ({
    exercise_id: e.exercise_id,
    concept: e.concept,
    answer_type: e.answer_type,
    difficulty: e.difficulty,
    answerLabel: e.answerLabel,
    timeframe: e.timeframe,
    real: e.provenance !== undefined,
    trading_date: e.provenance?.trading_date ?? null,
    practice_ready: isPracticeReady(e),
  }));
}
