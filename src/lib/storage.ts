// Browser-only persistence (PRD FR-16: progress persists via localStorage,
// no login). Every function here is safe to call from server-rendered code
// paths too — they just no-op / return empty values when `window` isn't
// available, so callers only need to guard against hydration timing, not
// against SSR crashing.

import { CONCEPT_LIST } from "@/lib/concepts";

/** Bump this whenever SessionState's shape changes. loadSession() discards
 * anything saved under an older (or missing/mismatched) version instead of
 * trusting it — this is what caught the Phase 3 -> Phase 4 session shape
 * change (old sessions had no `concept` field) after the fact. */
const SESSION_SCHEMA_VERSION = 1;

/** One row per PRD Section 9 — the fields a future `attempts` table would have. */
export type StoredAttempt = {
  attempt_id: string;
  session_id: string;
  exercise_id: string;
  concept: string;
  user_answer_type: "region" | "level" | "none";
  /** Zone (region) answers only; null otherwise. */
  user_price_low: number | null;
  user_price_high: number | null;
  user_candle_start: number | null;
  user_candle_end: number | null;
  /** Level answers only; null otherwise. */
  user_price: number | null;
  /** Level answers only; null otherwise. Signed: positive = placed above
   * the true level, negative = below. */
  distance_from_level: number | null;
  is_correct: boolean;
  /** Zone answers only; null otherwise. */
  coverage: number | null;
  precision_ratio: number | null;
  failure_reason: string | null;
  response_time_ms: number;
  /** Repeat exposure to this exercise_id, across all sessions ever. */
  attempt_number: number;
  timestamp: string;
};

export type SessionState = {
  version: number;
  session_id: string;
  concept: string;
  exercise_order: string[];
  /** Index into exercise_order of the exercise currently being shown. Equal
   * to exercise_order.length once the session is complete. */
  current_index: number;
  correct_count: number;
  missed_exercise_ids: string[];
  completed: boolean;
};

/** Runtime check that stored session data is actually usable — catches
 * both a schema-version mismatch and an unrecognized/missing concept, so
 * a bad shape is discarded instead of reaching the concept picker's caller
 * as an assumed-valid SessionState. */
function isValidSessionState(value: unknown): value is SessionState {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    v.version === SESSION_SCHEMA_VERSION &&
    typeof v.session_id === "string" &&
    typeof v.concept === "string" &&
    CONCEPT_LIST.includes(v.concept as (typeof CONCEPT_LIST)[number]) &&
    Array.isArray(v.exercise_order) &&
    v.exercise_order.every((id) => typeof id === "string") &&
    typeof v.current_index === "number" &&
    typeof v.correct_count === "number" &&
    Array.isArray(v.missed_exercise_ids) &&
    typeof v.completed === "boolean"
  );
}

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
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isValidSessionState(parsed)) {
      // Stale/incompatible data (e.g. saved before a SessionState shape
      // change) — discard it rather than handing back something that
      // looks valid but isn't, so callers never see the picker skipped
      // with garbage data behind it.
      window.localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveSession(session: SessionState): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

/** Clears the persisted session so the next visit shows the concept picker
 * instead of resuming a completed session. */
export function clearSession(): void {
  if (!isBrowser()) return;
  window.localStorage.removeItem(SESSION_KEY);
}

function generateId(prefix: string): string {
  if (isBrowser() && window.crypto && "randomUUID" in window.crypto) {
    return `${prefix}_${window.crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export function createSession(concept: string, exerciseIds: string[]): SessionState {
  return {
    version: SESSION_SCHEMA_VERSION,
    session_id: generateId("session"),
    concept,
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

/** Accuracy per concept, e.g. { FVG: 80, Liquidity: 40 } — only for
 * concepts with at least one recorded attempt. */
export function getAccuracyByConcept(
  attempts: StoredAttempt[],
): Record<string, number> {
  const byConcept = new Map<string, { correct: number; total: number }>();
  for (const attempt of attempts) {
    const entry = byConcept.get(attempt.concept) ?? { correct: 0, total: 0 };
    entry.total += 1;
    if (attempt.is_correct) entry.correct += 1;
    byConcept.set(attempt.concept, entry);
  }
  const result: Record<string, number> = {};
  for (const [concept, { correct, total }] of byConcept) {
    result[concept] = Math.round((correct / total) * 100);
  }
  return result;
}

/** The most recently *completed* session's score, or "—" if none yet
 * (including while a session is still in progress). */
export function getSessionScoreLabel(session: SessionState | null): string {
  if (!session || !session.completed) return "—";
  return `${session.correct_count}/${session.exercise_order.length}`;
}
