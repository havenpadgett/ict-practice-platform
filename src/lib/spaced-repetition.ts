// Spaced repetition for mistakes: a cleared mistake comes back days later,
// to check it was learned and not just remembered from a minute ago.
// Scheduling is derived from attempts alone (no table of its own, so it can
// never drift from what was recorded), pure, and documented in
// docs/SPACED-REPETITION.md. Words are reserved:
//
//   cleared   one correct answer after the last miss (a single retry)
//   mastered  four correct answers after the last miss, in four separate
//             sessions, each at least the scheduled interval after the one
//             before: 1 day, then 3, then 7 (so at least 11 days in all)
//
// A retry made the same hour proves recall, not learning; mastery is the
// state where the chart was right again after the memory of it had faded.

/** Days to wait after a counted correct answer before the next one can
 * count: 1 after the clearing retry, 3 after the first recheck, 7 after the
 * second. */
export const REVIEW_INTERVALS_DAYS = [1, 3, 7] as const;
/** Correct answers needed: the clearing retry plus one per interval. */
export const MASTERY_SUCCESSES = REVIEW_INTERVALS_DAYS.length + 1;

const DAY_MS = 24 * 60 * 60 * 1000;

export type ReviewStage = "open" | "cleared" | "confirming" | "mastered";

export type ReviewAttempt = {
  is_correct: boolean;
  created_at: string;
  /** Unknown (older rows) reads as "can't tell", which doesn't block counting. */
  session_id?: string | null;
};

export type ReviewState = {
  stage: ReviewStage;
  /** Correct answers that count, since the last miss (0 while open). */
  successes: number;
  /** Rechecks passed after the clearing retry: successes - 1, 0 to 3. */
  confirmations: number;
  /** When the next recheck can count, or null (open, or mastered). */
  dueAt: string | null;
  /** The next recheck can count now. */
  due: boolean;
  /** When the clearing retry happened. */
  clearedAt: string | null;
  /** When the final recheck passed. */
  masteredAt: string | null;
  /** Times a chart that had been answered correctly was missed again. */
  lapses: number;
};

const time = (iso: string) => new Date(iso).getTime();

/** The state of one exercise's attempts as of `now`, or null if it was
 * never missed (so it was never a mistake). */
export function reviewState(attempts: ReviewAttempt[], now: Date = new Date()): ReviewState | null {
  const sorted = [...attempts].sort((a, b) => a.created_at.localeCompare(b.created_at));
  let lastMiss = -1;
  let lapses = 0;
  sorted.forEach((a, i) => {
    if (!a.is_correct) {
      lastMiss = i;
      if (i > 0 && sorted[i - 1].is_correct) lapses += 1;
    }
  });
  if (lastMiss === -1) return null;

  // Everything after the last miss is correct. The first is the clearing
  // retry; each later one counts only if it's in another session and far
  // enough after the previous counted answer for the next interval.
  const counted: ReviewAttempt[] = [];
  for (const a of sorted.slice(lastMiss + 1)) {
    if (counted.length === 0) {
      counted.push(a);
    } else if (counted.length < MASTERY_SUCCESSES) {
      const prev = counted[counted.length - 1];
      const wait = REVIEW_INTERVALS_DAYS[counted.length - 1] * DAY_MS;
      const otherSession = !a.session_id || !prev.session_id || a.session_id !== prev.session_id;
      if (otherSession && time(a.created_at) - time(prev.created_at) >= wait) counted.push(a);
    }
  }

  const successes = counted.length;
  const stage: ReviewStage = successes === 0 ? "open" : successes === 1 ? "cleared" : successes < MASTERY_SUCCESSES ? "confirming" : "mastered";
  const last = counted[successes - 1];
  const dueMs = successes >= 1 && successes < MASTERY_SUCCESSES ? time(last.created_at) + REVIEW_INTERVALS_DAYS[successes - 1] * DAY_MS : null;
  return {
    stage,
    successes,
    confirmations: Math.max(0, successes - 1),
    dueAt: dueMs === null ? null : new Date(dueMs).toISOString(),
    due: dueMs !== null && now.getTime() >= dueMs,
    clearedAt: counted[0]?.created_at ?? null,
    masteredAt: stage === "mastered" ? last.created_at : null,
    lapses,
  };
}
