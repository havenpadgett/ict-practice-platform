// Small progress summaries for the dashboard and analytics: recent volume,
// per-concept trend, and recent sessions. Pure functions over attempts
// (newest last, as fetchAttempts returns them).

import { MIN_ATTEMPTS_FOR_ACCURACY } from "@/lib/practice-modes";

type AttemptLike = { concept: string; is_correct: boolean; created_at: string; session_id?: string | null };

const DAY_MS = 24 * 60 * 60 * 1000;

/** Attempts made in the last `days` days (rolling, not calendar). */
export function attemptsSince<T extends { created_at: string }>(attempts: T[], days: number, now = Date.now()): T[] {
  const cutoff = now - days * DAY_MS;
  return attempts.filter((a) => Date.parse(a.created_at) >= cutoff);
}

export type Trend = "up" | "down" | "steady";

/** Trend for one concept's attempts: the last 5 against the 5 before.
 * Null below 10 attempts, where a direction would be noise. A change of
 * 2 or more answers out of 5 counts as movement. */
export function conceptTrend(attempts: AttemptLike[]): Trend | null {
  if (attempts.length < 2 * MIN_ATTEMPTS_FOR_ACCURACY) return null;
  const rate = (xs: AttemptLike[]) => xs.filter((a) => a.is_correct).length / xs.length;
  const last = attempts.slice(-MIN_ATTEMPTS_FOR_ACCURACY);
  const before = attempts.slice(-2 * MIN_ATTEMPTS_FOR_ACCURACY, -MIN_ATTEMPTS_FOR_ACCURACY);
  const diff = rate(last) - rate(before);
  return diff >= 0.4 ? "up" : diff <= -0.4 ? "down" : "steady";
}

export type SessionSummaryRow = {
  sessionId: string;
  endedAt: string;
  concepts: string[];
  correct: number;
  total: number;
};

/** The most recent sessions that have a session id, newest first. */
export function recentSessions(attempts: AttemptLike[], limit = 3): SessionSummaryRow[] {
  const bySession = new Map<string, SessionSummaryRow>();
  for (const a of attempts) {
    if (!a.session_id) continue;
    const row = bySession.get(a.session_id) ?? { sessionId: a.session_id, endedAt: a.created_at, concepts: [], correct: 0, total: 0 };
    row.total += 1;
    if (a.is_correct) row.correct += 1;
    if (!row.concepts.includes(a.concept)) row.concepts.push(a.concept);
    if (a.created_at > row.endedAt) row.endedAt = a.created_at;
    bySession.set(a.session_id, row);
  }
  return [...bySession.values()].sort((a, b) => b.endedAt.localeCompare(a.endedAt)).slice(0, limit);
}

export type ModeFilter = "all" | "recognition" | "guided" | "free";

/** Attempts in a period, practice mode and concept (all optional). */
export function filterAttempts<T extends { created_at: string; concept: string }>(
  attempts: T[],
  opts: { days: number | null; mode: ModeFilter; concept: string },
  now = Date.now(),
): T[] {
  const inPeriod = opts.days === null ? attempts : attemptsSince(attempts, opts.days, now);
  return inPeriod.filter((a) => {
    if (opts.concept !== "all" && a.concept !== opts.concept) return false;
    if (opts.mode === "guided") return a.concept === "GuidedEntry";
    if (opts.mode === "free") return a.concept === "FreeTrade";
    if (opts.mode === "recognition") return a.concept !== "GuidedEntry" && a.concept !== "FreeTrade";
    return true;
  });
}

/** Accuracy and count per difficulty level, levels with attempts only. */
export function rateByDifficulty(attempts: { difficulty: 1 | 2 | 3 | null; is_correct: boolean }[]): { level: 1 | 2 | 3; attempts: number; accuracy: number }[] {
  return ([1, 2, 3] as const)
    .map((level) => {
      const at = attempts.filter((a) => a.difficulty === level);
      return { level, attempts: at.length, accuracy: at.length ? at.filter((a) => a.is_correct).length / at.length : 0 };
    })
    .filter((r) => r.attempts > 0);
}
