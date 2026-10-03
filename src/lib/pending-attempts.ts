// Results from exercises answered without an account (shared challenge
// links, the daily challenge, the landing sample). The server grades and
// builds the attempt row exactly as it would for a signed-in user
// (src/app/c/actions.ts); the browser keeps it here, and once the visitor
// has an account the dashboard offers to add it to their history. Nothing
// leaves this device before then.

import type { NewAttempt } from "@/lib/attempts";

const KEY = "ict-practice:pending-results";
/** Fired on window when a result is kept, so anything showing derived state (the daily streak) can refresh. */
export const PENDING_CHANGED_EVENT = "ict:pending-changed";
/** Enough for a long browsing session; the oldest go first. */
const MAX = 50;

export type PendingResult = { row: NewAttempt; answered_at: string };

function isPending(v: unknown): v is PendingResult {
  if (typeof v !== "object" || v === null) return false;
  const p = v as Record<string, unknown>;
  const row = p.row as Record<string, unknown> | undefined;
  return (
    typeof p.answered_at === "string" &&
    typeof row === "object" && row !== null &&
    typeof row.exercise_id === "string" && typeof row.is_correct === "boolean" && typeof row.answer_type === "string"
  );
}

export function loadPending(): PendingResult[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(isPending) : [];
  } catch {
    return [];
  }
}

/** Keeps the result. Answering the same exercise in the same session again
 * (a refresh and re-answer) replaces the earlier one rather than doubling it. */
export function addPending(row: NewAttempt): void {
  if (typeof window === "undefined") return;
  try {
    const kept = loadPending().filter((p) => !(p.row.session_id === row.session_id && p.row.exercise_id === row.exercise_id));
    const next = [...kept, { row, answered_at: new Date().toISOString() }].slice(-MAX);
    window.localStorage.setItem(KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(PENDING_CHANGED_EVENT));
  } catch {
    // Storage full or blocked: the result is still on screen, just not kept.
  }
}

export function clearPending(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Best-effort.
  }
}
