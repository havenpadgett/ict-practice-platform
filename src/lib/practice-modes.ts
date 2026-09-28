// How the practice picker groups and describes what can be practiced.
// Display and estimates only: which exercises a session gets is decided in
// src/lib/session-builder.ts and src/lib/recommendations.ts. Reads the
// answer-free catalog, so it's safe in the browser.

import { getExerciseMeta, getPracticeCatalog, type ExerciseMeta } from "@/data/catalog";
import type { ConceptScore } from "@/lib/recommendations";
import { DIFFICULTY_LABELS, type Concept } from "@/lib/concepts";

/** Recognition concepts, in teaching order. Time-based liquidity is shown
 * as a variant of Liquidity rather than a mode of its own. */
export const RECOGNITION_CONCEPTS: Concept[] = ["FVG", "IFVG", "Liquidity", "MSS", "OrderBlock", "PremiumDiscount"];
export const LIQUIDITY_VARIANT: Concept = "TimeLiquidity";
export const TRADE_CONCEPTS: Concept[] = ["GuidedEntry", "FreeTrade"];

/** Rough time to answer one exercise, including reading the feedback. */
const SECONDS_PER_EXERCISE: Record<ExerciseMeta["answer_type"], number> = {
  zone: 45,
  level: 40,
  choice: 30,
  guided: 120,
  free: 240,
};

/** Estimated minutes for a list of exercises, at least 1. */
export function estimateMinutes(ids: string[]): number {
  const seconds = ids.reduce((sum, id) => {
    const meta = getExerciseMeta(id);
    return sum + (meta ? SECONDS_PER_EXERCISE[meta.answer_type] : 45);
  }, 0);
  return Math.max(1, Math.round(seconds / 60));
}

/** Estimated minutes for `count` exercises of a concept. */
export function estimateConceptMinutes(concept: Concept, count: number): number {
  const pool = getPracticeCatalog(concept);
  if (pool.length === 0) return 0;
  const avg = pool.reduce((s, e) => s + SECONDS_PER_EXERCISE[e.answer_type], 0) / pool.length;
  return Math.max(1, Math.round((avg * count) / 60));
}

/** "Easy–Hard", "Medium", ... from the practice-ready exercises. */
export function difficultyRange(concept: Concept): string {
  const levels = getPracticeCatalog(concept).map((e) => e.difficulty);
  if (levels.length === 0) return "";
  const lo = Math.min(...levels) as 1 | 2 | 3;
  const hi = Math.max(...levels) as 1 | 2 | 3;
  return lo === hi ? DIFFICULTY_LABELS[lo] : `${DIFFICULTY_LABELS[lo]}–${DIFFICULTY_LABELS[hi]}`;
}

/** Below this many attempts an accuracy figure is noise, so it isn't shown
 * as a percentage anywhere (same spirit as the engine's
 * MIN_ATTEMPTS_FOR_WEAK). */
export const MIN_ATTEMPTS_FOR_ACCURACY = 5;

/** "73% · 22 attempts", "3 attempts · not enough to score yet", or
 * "Not started". */
export function accuracyLabel(stats: Pick<ConceptScore, "attempts" | "accuracy"> | undefined): string {
  if (!stats || stats.attempts === 0) return "Not started";
  const n = `${stats.attempts} attempt${stats.attempts === 1 ? "" : "s"}`;
  if (stats.attempts < MIN_ATTEMPTS_FOR_ACCURACY) return `${n} · not enough to score yet`;
  return `${Math.round(stats.accuracy * 100)}% · ${n}`;
}
