// DEMO MODE (see ./gate.ts). Server-only in-memory store the fake Supabase
// client reads and writes. Seeded with made-up practice history for the
// demo reviewer; everything they do lands here and is lost when the dev
// server stops. It has no connection to Supabase at all.

import { exercises, isPracticeReady, type Exercise } from "@/data/exercises";
import { createFakeSupabase, type DemoQuery, type DemoResult, type DemoRpc } from "@/lib/demo/fake-supabase";
import { DEMO_USER } from "@/lib/demo/gate";

type Row = Record<string, unknown>;
type Db = Record<"attempts" | "profiles" | "practice_events" | "question_reports", Row[]>;

const TABLES = ["attempts", "profiles", "practice_events", "question_reports"] as const;

// Deterministic, so every reviewer sees the same history.
function rng(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Seeded accuracy per concept, so the analytics have something to show. */
const SKILL: Record<string, number> = {
  FVG: 0.82, Liquidity: 0.7, MSS: 0.58, IFVG: 0.5, OrderBlock: 0.62,
  TimeLiquidity: 0.75, PremiumDiscount: 0.8, GuidedEntry: 0.45, FreeTrade: 0.4,
};

function answerFields(e: Exercise, correct: boolean, r: () => number): Row {
  const price = e.candles[Math.floor(e.candles.length / 2)].close;
  switch (e.answer_type) {
    case "zone":
      return {
        user_answer_type: "region",
        user_price_low: Math.round(price - 20), user_price_high: Math.round(price + 5),
        user_candle_start: 10, user_candle_end: 14,
        coverage: correct ? 0.7 + r() * 0.3 : r() * 0.5, precision_ratio: 1 + r() * (correct ? 1.2 : 2.5),
        failure_reason: correct ? null : "coverage",
      };
    case "level":
      return {
        user_answer_type: "level", user_price: Math.round(price),
        distance_from_level: correct ? r() * 4 - 2 : 10 + r() * 30, failure_reason: correct ? null : "off_level",
      };
    case "choice": {
      const right = e.answer.correct_choice;
      const wrong = e.options.find((o) => o.value !== right)?.value ?? right;
      return {
        user_answer_type: "choice", user_choice: correct ? right : wrong, correct_choice: right,
        failure_reason: correct ? null : "wrong_choice",
      };
    }
    case "guided": {
      const bias = e.answer.bias === "unclear" ? "bullish" : e.answer.bias;
      return {
        user_answer_type: "guided", guided_bias_choice: correct ? e.answer.bias : bias === "bullish" ? "bearish" : "bullish",
        guided_bias_correct: correct, guided_entry_correct: null, guided_stop_correct: null, guided_target_correct: null,
        guided_declared_trade: false,
      };
    }
    case "free":
      return {
        user_answer_type: "free", free_direction: "none", free_outcome: "no_trade",
        free_decision_correct: correct, free_direction_correct: null, free_entry_correct: null,
        free_stop_correct: null, free_rr_correct: null,
      };
  }
}

function seed(): Db {
  const r = rng(20260927);
  const pool = exercises.filter(isPracticeReady);
  const db: Db = {
    attempts: [],
    profiles: [],
    practice_events: [],
    question_reports: [],
  };
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  let lastDay = 0;
  // About three weeks of sessions, most days, 5 to 10 exercises each.
  for (let d = 21; d >= 1; d--) {
    if (r() < 0.3) continue;
    lastDay = d;
    const sessionId = `session_demo_${d}`;
    const start = now - d * day + 17 * 60 * 60 * 1000;
    const count = 5 + Math.floor(r() * 6);
    const attemptsSoFar = db.attempts.length;
    db.practice_events.push({
      id: crypto.randomUUID(), user_id: DEMO_USER.id, session_id: sessionId, event_type: "session_started",
      mode: "adaptive", concept: "Adaptive", source: "adaptive_mix", planned_length: count, created_at: new Date(start).toISOString(),
    });
    for (let i = 0; i < count; i++) {
      const e = pool[Math.floor(r() * pool.length)];
      // Accuracy improves a little over the three weeks.
      const correct = r() < Math.min(0.95, (SKILL[e.concept] ?? 0.6) + (21 - d) * 0.008);
      const prior = db.attempts.filter((a) => a.exercise_id === e.exercise_id).length;
      db.attempts.push({
        id: crypto.randomUUID(), user_id: DEMO_USER.id, exercise_id: e.exercise_id, session_id: sessionId,
        concept: e.concept, difficulty: e.difficulty, answer_type: e.answer_type, is_correct: correct,
        response_time_ms: Math.round(8000 + r() * 40000), attempt_number: prior + 1,
        created_at: new Date(start + (i + 1) * 90_000).toISOString(),
        ...answerFields(e, correct, r),
      });
    }
    db.practice_events.push({
      id: crypto.randomUUID(), user_id: DEMO_USER.id, session_id: sessionId, event_type: "session_completed",
      position: db.attempts.length - attemptsSoFar, created_at: new Date(start + (count + 1) * 90_000).toISOString(),
    });
  }
  const last = new Date(now - lastDay * day);
  db.profiles.push({
    id: DEMO_USER.id, username: "demo-reviewer", role: "user", current_streak: 3,
    last_completed_date: `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, "0")}-${String(last.getDate()).padStart(2, "0")}`,
    created_at: new Date(now - 22 * day).toISOString(),
  });
  return db;
}

// Kept on globalThis so dev-server hot reloads don't wipe the reviewer's work.
const g = globalThis as unknown as { __ictDemoDb?: Db };
function db(): Db {
  g.__ictDemoDb ??= seed();
  return g.__ictDemoDb;
}

/** Starts the demo over from the seed (tests). */
export function resetDemoStore(): void {
  g.__ictDemoDb = seed();
}

const ok = (data: unknown, count: number | null = null): DemoResult => ({ data, error: null, count });
const fail = (code: string, message: string): DemoResult => ({ data: null, error: { code, message }, count: null });

function project(row: Row, columns: string): Row {
  if (columns.trim() === "*") return { ...row };
  const out: Row = {};
  for (const c of columns.split(",").map((s) => s.trim()).filter(Boolean)) out[c] = row[c] ?? null;
  return out;
}

function withDefaults(table: string, v: Row): Row {
  // Every row belongs to the demo reviewer, whatever the request says.
  const owner = table === "profiles" ? { id: DEMO_USER.id } : { user_id: DEMO_USER.id };
  return { id: crypto.randomUUID(), created_at: new Date().toISOString(), ...(table === "question_reports" ? { status: "open" } : {}), ...v, ...owner };
}

function runRpc(name: string): DemoResult {
  switch (name) {
    // The reviewer is an ordinary user: /admin and /review stay closed, so
    // demo mode can't edit the scenario files either.
    case "current_role_name":
      return ok("user");
    case "is_admin":
    case "is_reviewer":
      return ok(false);
    default:
      return fail("PGRST202", `Function ${name} isn't available in demo mode.`);
  }
}

export async function executeDemo(request: DemoQuery | DemoRpc): Promise<DemoResult> {
  if ("rpc" in request) return runRpc(request.rpc);
  const q = request;
  if (!TABLES.includes(q.table as (typeof TABLES)[number])) {
    // Views and anything else: missing, so the app uses its fallbacks.
    return fail("42P01", `relation "${q.table}" does not exist in demo mode`);
  }
  const rows = db()[q.table as (typeof TABLES)[number]];
  const matches = (row: Row) => q.filters.every(([c, v]) => row[c] === v);

  if (q.action === "insert" || q.action === "upsert") {
    const values = (Array.isArray(q.values) ? q.values : [q.values ?? {}]).map((v) => withDefaults(q.table, v));
    for (const v of values) {
      const key = q.onConflict ?? "id";
      const existing = q.action === "upsert" ? rows.findIndex((row) => row[key] === v[key]) : -1;
      if (existing === -1) rows.push(v);
      else if (!q.ignoreDuplicates) rows[existing] = { ...rows[existing], ...v };
    }
    return ok(null);
  }
  if (q.action === "update") {
    for (const row of rows) if (matches(row)) Object.assign(row, q.values, q.table === "profiles" ? { id: row.id } : { user_id: row.user_id });
    return ok(null);
  }
  if (q.action === "delete") return fail("demo_mode", "Deleting isn't available in demo mode.");

  let found = rows.filter(matches);
  if (q.order) {
    const { column, ascending } = q.order;
    found = [...found].sort((a, b) => String(a[column]).localeCompare(String(b[column])) * (ascending ? 1 : -1));
  }
  if (q.limit !== null) found = found.slice(0, q.limit);
  const count = q.count ? found.length : null;
  if (q.head) return ok(null, count);
  const data = found.map((row) => project(row, q.columns));
  if (q.single === "maybe") return ok(data[0] ?? null, count);
  if (q.single === "one") return data.length === 1 ? ok(data[0], count) : fail("PGRST116", "Expected one row.");
  return ok(data, count);
}

/** Server half of the fake client: runs straight against the store. */
export function createDemoServerClient() {
  return createFakeSupabase(executeDemo);
}
