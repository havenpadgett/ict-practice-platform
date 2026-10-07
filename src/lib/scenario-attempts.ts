// Saving and reading scenario attempts (the engine's `scenario_attempts`
// table, supabase/migrations/20261006120000_scenario_attempts.sql, not yet
// applied: B4). Until the table exists, or when nobody is signed in, results
// are kept on this device so nothing a learner does is lost; when the table
// is there they are copied up the next time the history is read. Pure
// aggregates live apart, in src/lib/engine/history.ts.

import { createClient } from "@/lib/supabase/client";
import type { ScenarioAttemptRow, StoredScenarioAttempt } from "@/lib/engine/attempt-row";

const KEY = "ict-practice:scenario-attempts";
const MAX_LOCAL = 400;
/** Fired on window after an attempt is saved, so the dashboard and journal refresh. */
export const SCENARIO_ATTEMPTS_CHANGED = "ict:scenario-attempts-changed";

const isMissingTable = (err: { code?: string; message?: string } | null) =>
  err?.code === "42P01" || err?.code === "PGRST205" || /scenario_attempts/.test(err?.message ?? "") && /exist|schema cache/.test(err?.message ?? "");

function readLocal(): StoredScenarioAttempt[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as StoredScenarioAttempt[]).filter((a) => a && typeof a.id === "string" && typeof a.scenario_id === "string") : [];
  } catch {
    return [];
  }
}

function writeLocal(list: StoredScenarioAttempt[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list.slice(-MAX_LOCAL)));
  } catch {
    // Storage full or blocked: the attempt is still on screen.
  }
}

function notify(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(SCENARIO_ATTEMPTS_CHANGED));
}

const newId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `local-${Date.now()}-${Math.random().toString(36).slice(2)}`);

/** Saves one attempt: to the account when there is one and the table exists,
 * otherwise to this device. Returns where it went. */
export async function saveScenarioAttempt(userId: string | null, row: ScenarioAttemptRow): Promise<{ id: string; source: "account" | "device" }> {
  const local = readLocal();
  const prior = local.filter((a) => a.scenario_id === row.scenario_id).length;
  if (userId) {
    try {
      const supabase = createClient();
      const { count } = await supabase.from("scenario_attempts").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("scenario_id", row.scenario_id);
      const attempt_number = (count ?? prior) + 1;
      const { error } = await supabase.from("scenario_attempts").insert({ ...row, attempt_number, user_id: userId });
      if (!error) {
        notify();
        return { id: "", source: "account" };
      }
      if (!isMissingTable(error)) throw error;
    } catch (err) {
      if (!isMissingTable(err as { code?: string; message?: string })) throw err;
    }
  }
  const stored: StoredScenarioAttempt = { ...row, attempt_number: prior + 1, id: newId(), created_at: new Date().toISOString(), source: "device" };
  writeLocal([...local, stored]);
  notify();
  return { id: stored.id, source: "device" };
}

/** Everything the learner has done, oldest first: the account's rows plus
 * any kept on this device. Device rows are copied up when the table exists. */
export async function fetchScenarioAttempts(userId: string | null): Promise<StoredScenarioAttempt[]> {
  const local = readLocal();
  if (!userId) return local;
  let remote: StoredScenarioAttempt[] = [];
  try {
    const supabase = createClient();
    const { data, error } = await supabase.from("scenario_attempts").select("*").eq("user_id", userId).order("created_at", { ascending: true });
    if (error) {
      if (isMissingTable(error)) return local;
      throw error;
    }
    remote = ((data ?? []) as Omit<StoredScenarioAttempt, "source">[]).map((r) => ({ ...r, source: "account" as const }));
    // Copy device rows up now that the table is there.
    if (local.length > 0) {
      const rows = local.map((a) => {
        const row: Record<string, unknown> = { ...a, user_id: userId };
        delete row.id;
        delete row.created_at;
        delete row.source;
        return row;
      });
      const { error: upError } = await supabase.from("scenario_attempts").insert(rows);
      if (!upError) {
        writeLocal([]);
        return fetchScenarioAttempts(userId);
      }
    }
  } catch {
    return local;
  }
  return [...remote, ...local].sort((a, b) => a.created_at.localeCompare(b.created_at));
}
