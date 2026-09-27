// Review Mistakes: which exercises a user has answered incorrectly, and
// which of those they've since got right. Derived from attempts alone, so
// it needs no table of its own and never drifts from what was recorded.
// Pure and answer-free, so the dashboard can use it in the browser; the
// answers themselves come from the server (src/app/mistakes/actions.ts).

/** An exercise with at least one incorrect attempt is a mistake. It's
 * mastered once the user's most recent attempt at it is correct, and open
 * again if they miss it after that. */
export type MistakeStatus = "open" | "mastered";

export type MistakeSummary = {
  exercise_id: string;
  status: MistakeStatus;
  /** Incorrect attempts at this exercise, all time. */
  missed: number;
  /** The most recent incorrect attempt. */
  lastMissedAt: string;
  /** When the latest (correct) attempt was made; null while open. */
  masteredAt: string | null;
};

type AttemptLike = { exercise_id: string; is_correct: boolean; created_at: string };

/** One entry per exercise ever answered incorrectly: open first, most
 * recently missed first within each group. */
export function summarizeMistakes(attempts: AttemptLike[]): MistakeSummary[] {
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
    out.push({
      exercise_id,
      status: latest.is_correct ? "mastered" : "open",
      missed: misses.length,
      lastMissedAt: misses[misses.length - 1].created_at,
      masteredAt: latest.is_correct ? latest.created_at : null,
    });
  }
  return out.sort((a, b) =>
    a.status === b.status ? b.lastMissedAt.localeCompare(a.lastMissedAt) : a.status === "open" ? -1 : 1,
  );
}

export function mistakeCounts(attempts: AttemptLike[]): { open: number; mastered: number } {
  const all = summarizeMistakes(attempts);
  return {
    open: all.filter((m) => m.status === "open").length,
    mastered: all.filter((m) => m.status === "mastered").length,
  };
}

/** Longest mistakes-only session; the rest wait for the next one. */
export const MISTAKES_SESSION_CAP = 20;

/** Open mistakes for a mistakes-only session, most recently missed first,
 * limited to ids the caller can still serve. */
export function mistakeSessionIds(attempts: AttemptLike[], isAvailable: (id: string) => boolean): string[] {
  return summarizeMistakes(attempts)
    .filter((m) => m.status === "open" && isAvailable(m.exercise_id))
    .slice(0, MISTAKES_SESSION_CAP)
    .map((m) => m.exercise_id);
}
