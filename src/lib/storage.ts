// Browser-only persistence (PRD FR-16: progress persists via localStorage,
// no login). Every function here is safe to call from server-rendered code
// paths too — they just no-op / return empty values when `window` isn't
// available, so callers only need to guard against hydration timing, not
// against SSR crashing.

/** One row per PRD Section 9 — the fields a future `attempts` table would have. */
export type StoredAttempt = {
  attempt_id: string;
  session_id: string;
  exercise_id: string;
  concept: string;
  user_answer_type: "region" | "none";
  /** Raw answer; null when user_answer_type is "none" (no box was drawn). */
  user_price_low: number | null;
  user_price_high: number | null;
  user_candle_start: number | null;
  user_candle_end: number | null;
  is_correct: boolean;
  coverage: number | null;
  precision_ratio: number | null;
  failure_reason: string | null;
  response_time_ms: number;
  /** Repeat exposure to this exercise_id, across all sessions ever. */
  attempt_number: number;
  timestamp: string;
};

export type SessionState = {
  session_id: string;
  exercise_order: string[];
  /** Index into exercise_order of the exercise currently being shown. Equal
   * to exercise_order.length once the session is complete. */
  current_index: number;
  correct_count: number;
  missed_exercise_ids: string[];
  completed: boolean;
};

const ATTEMPTS_KEY = "ict-practice:attempts";
const SESSION_KEY = "ict-practice:session";

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

export function loadAttempts(): StoredAttempt[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(ATTEMPTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as StoredAttempt[]) : [];
  } catch {
    return [];
  }
}

function saveAttempts(attempts: StoredAttempt[]): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(ATTEMPTS_KEY, JSON.stringify(attempts));
}

export function appendAttempt(attempt: StoredAttempt): StoredAttempt[] {
  const attempts = loadAttempts();
  attempts.push(attempt);
  saveAttempts(attempts);
  return attempts;
}

/** "Repeat exposure to the same exercise" (PRD Section 9) — how many times
 * this exercise_id has been attempted before, across every past session. */
export function nextAttemptNumber(
  attempts: StoredAttempt[],
  exerciseId: string,
): number {
  return attempts.filter((a) => a.exercise_id === exerciseId).length + 1;
}

export function loadSession(): SessionState | null {
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as SessionState) : null;
  } catch {
    return null;
  }
}

export function saveSession(session: SessionState): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

function generateId(prefix: string): string {
  if (isBrowser() && window.crypto && "randomUUID" in window.crypto) {
    return `${prefix}_${window.crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export function createSession(exerciseIds: string[]): SessionState {
  return {
    session_id: generateId("session"),
    exercise_order: exerciseIds,
    current_index: 0,
    correct_count: 0,
    missed_exercise_ids: [],
    completed: false,
  };
}

export function createAttemptId(): string {
  return generateId("attempt");
}

// ---- Dashboard aggregates -------------------------------------------------
// Overall accuracy and exercises completed are lifetime totals across every
// attempt ever recorded, not just the current session — that's what makes
// them feel like ongoing progress rather than a per-session score.

export function getOverallAccuracy(attempts: StoredAttempt[]): number | null {
  if (attempts.length === 0) return null;
  const correct = attempts.filter((a) => a.is_correct).length;
  return Math.round((correct / attempts.length) * 100);
}

export function getExercisesCompletedCount(attempts: StoredAttempt[]): number {
  return attempts.length;
}

/** The most recently *completed* session's score, or "—" if none yet
 * (including while a session is still in progress). */
export function getSessionScoreLabel(session: SessionState | null): string {
  if (!session || !session.completed) return "—";
  return `${session.correct_count}/${session.exercise_order.length}`;
}
