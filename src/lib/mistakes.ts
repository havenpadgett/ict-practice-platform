// Review Mistakes: which exercises a user has answered incorrectly, and
// which of those they've since got right. Derived from attempts alone, so
// it needs no table of its own and never drifts from what was recorded.
// Pure and answer-free, so the dashboard can use it in the browser; the
// answers themselves come from the server (src/app/mistakes/actions.ts).

import { reviewState, type ReviewStage } from "@/lib/spaced-repetition";

/** An exercise with at least one incorrect attempt is a mistake. It's
 * cleared once the user's most recent attempt at it is correct, and open
 * again if they miss it after that. "Cleared", not "mastered": one correct
 * retry isn't mastery. Mastery is repeated success across separate sessions
 * days apart, and a cleared mistake comes back to be checked (spaced
 * repetition: src/lib/spaced-repetition.ts, docs/SPACED-REPETITION.md).
 * `status` stays two-valued (a mastered mistake is still not open); `stage`
 * is the full picture. */
export type MistakeStatus = "open" | "cleared";

export type MistakeSummary = {
  exercise_id: string;
  status: MistakeStatus;
  /** Incorrect attempts at this exercise, all time. */
  missed: number;
  /** The most recent incorrect attempt. */
  lastMissedAt: string;
  /** When the latest (correct) attempt was made; null while open. */
  clearedAt: string | null;
  /** open, cleared (one correct retry), confirming (rechecked at least
   * once), or mastered (rechecked across separated sessions). */
  stage: ReviewStage;
  /** Rechecks passed after the clearing retry, 0 to 3. */
  confirmations: number;
  /** When the next recheck can count; null while open or once mastered. */
  dueAt: string | null;
  /** A cleared or confirming mistake whose recheck can count now. */
  due: boolean;
  masteredAt: string | null;
  /** Times it was missed again after being answered correctly. */
  lapses: number;
};

type AttemptLike = { exercise_id: string; is_correct: boolean; created_at: string; session_id?: string | null };

/** One entry per exercise ever answered incorrectly: open first, then the
 * ones due a recheck, then the rest; most recently missed first within each
 * group. `now` is when "due" is judged (tests pass a fixed one). */
export function summarizeMistakes(attempts: AttemptLike[], now: Date = new Date()): MistakeSummary[] {
  const byExercise = new Map<string, AttemptLike[]>();
  for (const a of attempts) {
    const list = byExercise.get(a.exercise_id) ?? [];
    list.push(a);
    byExercise.set(a.exercise_id, list);
  }
  const out: MistakeSummary[] = [];
  for (const [exercise_id, list] of byExercise) {
    const sorted = [...list].sort((a, b) => a.created_at.localeCompare(b.created_at));
    const misses = sorted.filter((a) => !a.is_correct);
    if (misses.length === 0) continue;
    const latest = sorted[sorted.length - 1];
    const state = reviewState(sorted, now)!;
    out.push({
      exercise_id,
      status: latest.is_correct ? "cleared" : "open",
      missed: misses.length,
      lastMissedAt: misses[misses.length - 1].created_at,
      clearedAt: latest.is_correct ? latest.created_at : null,
      stage: state.stage,
      confirmations: state.confirmations,
      dueAt: state.dueAt,
      due: state.due,
      masteredAt: state.masteredAt,
      lapses: state.lapses,
    });
  }
  const rank = (m: MistakeSummary) => (m.status === "open" ? 0 : m.due ? 1 : 2);
  return out.sort((a, b) => rank(a) - rank(b) || (a.due && b.due ? (a.dueAt ?? "").localeCompare(b.dueAt ?? "") : b.lastMissedAt.localeCompare(a.lastMissedAt)));
}

export function mistakeCounts(
  attempts: AttemptLike[],
  now: Date = new Date(),
): { open: number; cleared: number; due: number; mastered: number } {
  const all = summarizeMistakes(attempts, now);
  return {
    open: all.filter((m) => m.status === "open").length,
    // Everything no longer open, mastered ones included.
    cleared: all.filter((m) => m.status === "cleared").length,
    // Cleared mistakes whose recheck can count now.
    due: all.filter((m) => m.due).length,
    mastered: all.filter((m) => m.stage === "mastered").length,
  };
}

/** Longest mistakes-only session; the rest wait for the next one. */
export const MISTAKES_SESSION_CAP = 20;

/** A mistakes-only session: open mistakes (most recently missed first),
 * then cleared ones that are due a recheck (the longest overdue first),
 * limited to ids the caller can still serve. */
export function mistakeSessionIds(attempts: AttemptLike[], isAvailable: (id: string) => boolean, now: Date = new Date()): string[] {
  return summarizeMistakes(attempts, now)
    .filter((m) => (m.status === "open" || m.due) && isAvailable(m.exercise_id))
    .slice(0, MISTAKES_SESSION_CAP)
    .map((m) => m.exercise_id);
}
