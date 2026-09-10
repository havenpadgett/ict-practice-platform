// Pure aggregation over DbAttempt[] for the /analytics page. No Supabase
// calls here (src/lib/attempts.ts owns fetching) — this only derives
// numbers, kept separate so the page/components stay display-only.

import { getExercise } from "@/data/exercises";
import type { DbAttempt } from "@/lib/attempts";

export type OverallStats = {
  accuracy: number | null;
  totalExercises: number;
  totalSessions: number;
};

/** A gap this long between two consecutive attempts (any concept) is
 * treated as the boundary between practice sessions. Attempts aren't
 * tagged with a session id in the database — SessionState (storage.ts) is
 * local, ephemeral UI state and was never part of the Supabase move — so
 * "how many sessions" has to be inferred from timing. 30 minutes is
 * generous enough that reading feedback or a short break mid-session never
 * splits it into two, and tight enough that a same-day return visit counts
 * as a new one. Cheap to author, easy to retune later — same reasoning as
 * grading.ts's fixed tolerances. */
const SESSION_GAP_MS = 30 * 60 * 1000;

function countSessions(attemptsAscending: DbAttempt[]): number {
  if (attemptsAscending.length === 0) return 0;
  let sessions = 1;
  for (let i = 1; i < attemptsAscending.length; i++) {
    const gap =
      new Date(attemptsAscending[i].created_at).getTime() -
      new Date(attemptsAscending[i - 1].created_at).getTime();
    if (gap > SESSION_GAP_MS) sessions += 1;
  }
  return sessions;
}

/** Assumes `attempts` is sorted ascending by created_at (fetchAttempts
 * guarantees this). */
export function getOverallStats(attempts: DbAttempt[]): OverallStats {
  if (attempts.length === 0) {
    return { accuracy: null, totalExercises: 0, totalSessions: 0 };
  }
  const correct = attempts.filter((a) => a.is_correct).length;
  return {
    accuracy: Math.round((correct / attempts.length) * 100),
    totalExercises: attempts.length,
    totalSessions: countSessions(attempts),
  };
}

export type ConceptHighlight = { concept: string; accuracy: number };

/** Named plainly per the strongest/weakest concept, from the same
 * accuracy-by-concept map the dashboard already computes (getAccuracyByConcept
 * in attempts.ts). Returns null only when no concept has any attempts yet. */
export function getStrongestAndWeakestConcept(
  byConcept: Record<string, number>,
): { strongest: ConceptHighlight; weakest: ConceptHighlight } | null {
  const entries = Object.entries(byConcept);
  if (entries.length === 0) return null;
  let strongest = entries[0];
  let weakest = entries[0];
  for (const entry of entries) {
    if (entry[1] > strongest[1]) strongest = entry;
    if (entry[1] < weakest[1]) weakest = entry;
  }
  return {
    strongest: { concept: strongest[0], accuracy: strongest[1] },
    weakest: { concept: weakest[0], accuracy: weakest[1] },
  };
}

export type ExerciseAccuracy = {
  exerciseId: string;
  /** answerLabel of the exercise (e.g. "Fair Value Gap"), falling back to
   * the exercise_id itself if the exercise can't be found (data removed or
   * renamed since the attempt was recorded). */
  label: string;
  concept: string;
  total: number;
  correct: number;
  missed: number;
  accuracy: number;
};

/** Sorted most-missed first — the PRD asks "which specific exercises are
 * missed most", so miss count (not accuracy %) drives the ranking; a 1/1
 * exercise (0% accuracy, 1 miss) shouldn't outrank a 3/10 one (3 misses)
 * just because its percentage looks worse. Ties break by accuracy, lowest
 * first. */
export function getAccuracyByExercise(attempts: DbAttempt[]): ExerciseAccuracy[] {
  const byExercise = new Map<string, { concept: string; correct: number; total: number }>();
  for (const attempt of attempts) {
    const entry = byExercise.get(attempt.exercise_id) ?? {
      concept: attempt.concept,
      correct: 0,
      total: 0,
    };
    entry.total += 1;
    if (attempt.is_correct) entry.correct += 1;
    byExercise.set(attempt.exercise_id, entry);
  }
  return Array.from(byExercise.entries())
    .map(([exerciseId, { concept, correct, total }]) => ({
      exerciseId,
      label: getExercise(exerciseId)?.answerLabel ?? exerciseId,
      concept,
      total,
      correct,
      missed: total - correct,
      accuracy: Math.round((correct / total) * 100),
    }))
    .sort((a, b) => b.missed - a.missed || a.accuracy - b.accuracy);
}

export type AccuracyBlock = { label: string; accuracy: number; count: number };

/** Blocks of 5 attempts, in the order they were recorded — 5 matches the
 * size of a practice session (every concept has exactly 5 exercises), so
 * each block reads roughly as "one session's worth" of accuracy even
 * though blocks are drawn from the raw attempt stream, not session
 * boundaries. Assumes `attempts` is sorted ascending by created_at. */
const IMPROVEMENT_BLOCK_SIZE = 5;

export function getAccuracyOverTime(
  attempts: DbAttempt[],
  blockSize: number = IMPROVEMENT_BLOCK_SIZE,
): AccuracyBlock[] {
  const blocks: AccuracyBlock[] = [];
  for (let i = 0; i < attempts.length; i += blockSize) {
    const block = attempts.slice(i, i + blockSize);
    const correct = block.filter((a) => a.is_correct).length;
    blocks.push({
      label: `${i + 1}–${i + block.length}`,
      accuracy: Math.round((correct / block.length) * 100),
      count: block.length,
    });
  }
  return blocks;
}

export type ResponseTimeStats = {
  avgCorrectMs: number | null;
  avgIncorrectMs: number | null;
};

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round(values.reduce((sum, v) => sum + v, 0) / values.length);
}

export function getResponseTimeStats(attempts: DbAttempt[]): ResponseTimeStats {
  const correct = attempts.filter((a) => a.is_correct).map((a) => a.response_time_ms);
  const incorrect = attempts.filter((a) => !a.is_correct).map((a) => a.response_time_ms);
  return {
    avgCorrectMs: average(correct),
    avgIncorrectMs: average(incorrect),
  };
}

/** e.g. 8300 -> "8.3s". Response times are always sub-minute in practice
 * (one exercise, one drawn answer), so no minutes formatting is needed. */
export function formatResponseTime(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}
