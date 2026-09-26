// 20260927130000_attempt_integrity.sql: every row the real grading code can
// produce is accepted, and rows that contradict themselves are refused.

import fs from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { exercises } from "@/data/exercises";
import type { NewAttempt } from "@/lib/attempts";
import { buildAnswerAttempt, buildFreeTradeAttempt, buildGuidedAttempt } from "@/lib/attempt-rows";
import { gradeFreeTrade, type FreeTradePosition } from "@/lib/free-trade-grading";
import { gradeAttempt, type UserAnswer } from "@/lib/grading";
import { gradeGuidedAttempt, type GuidedUserAnswer } from "@/lib/guided-grading";
import { A, applyMigrations, migratedDb, seed } from "./db";

let db: PGlite;

// migrateLocalAttempts writes through the browser client; capture its rows.
const captured: Record<string, unknown>[][] = [];
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ from: () => ({ insert: async (rows: Record<string, unknown>[]) => (captured.push(rows), { error: null }) }) }),
}));
const meta = { sessionId: "s-int", responseTimeMs: 4200, attemptNumber: 1 };

async function insert(row: NewAttempt): Promise<void> {
  const cols: Record<string, unknown> = { user_id: A, ...row };
  const keys = Object.keys(cols);
  await db.query(`insert into attempts (${keys.join(",")}) values (${keys.map((_, i) => `$${i + 1}`).join(",")})`, Object.values(cols));
}

/** Every answer shape the UI can submit for an exercise, graded by the real code. */
function realRows(): { label: string; row: NewAttempt }[] {
  const out: { label: string; row: NewAttempt }[] = [];
  for (const e of exercises) {
    const push = (label: string, row: NewAttempt) => out.push({ label: `${e.exercise_id} ${label}`, row });
    if (e.answer_type === "zone" || e.answer_type === "level") {
      const hi = Math.max(...e.candles.map((c) => c.high));
      const lo = Math.min(...e.candles.map((c) => c.low));
      const answers: UserAnswer[] = [
        { type: "none" },
        e.answer_type === "zone"
          ? { type: "region", region: { priceLow: lo, priceHigh: lo + (hi - lo) / 10, candleIndexLow: 0, candleIndexHigh: 2 } }
          : { type: "level", price: hi },
      ];
      if (e.answer_type === "zone" && e.answer) {
        const a = e.answer;
        answers.push({ type: "region", region: { priceLow: a.price_low, priceHigh: a.price_high, candleIndexLow: a.candle_start, candleIndexHigh: a.candle_end } });
      }
      if (e.answer_type === "level" && e.answer) answers.push({ type: "level", price: e.answer.price });
      for (const ans of answers) push(ans.type, buildAnswerAttempt(e, ans, gradeAttempt(e, ans), meta));
    } else if (e.answer_type === "choice") {
      for (const o of e.options) {
        const ans: UserAnswer = { type: "choice", choice: o.value };
        push(o.value, buildAnswerAttempt(e, ans, gradeAttempt(e, ans), meta));
      }
    } else if (e.answer_type === "guided") {
      const k = e.answer;
      const answers: GuidedUserAnswer[] = [
        { bias: "unclear", entry: null, stop: null, target: null, declaredTrade: false },
        { bias: "bullish", entry: e.candles[0].close, stop: null, target: null, declaredTrade: false },
      ];
      if (k.entry && k.stop && k.target && k.bias !== "unclear") {
        answers.push({ bias: k.bias, entry: k.entry.price, stop: k.stop.price, target: k.target.price, declaredTrade: true });
        // Target on the wrong side: a real mistake, negative R:R.
        answers.push({ bias: k.bias, entry: k.entry.price, stop: k.stop.price, target: k.stop.price, declaredTrade: true });
      }
      for (const [i, ans] of answers.entries()) push(`guided#${i}`, buildGuidedAttempt(e, ans, gradeGuidedAttempt(e, ans), meta));
    } else {
      push("no trade", buildFreeTradeAttempt(e, null, null, gradeFreeTrade(e, null, null), meta));
      const all = [...e.candles, ...e.hidden_candles];
      const entryIndex = e.candles.length - 1;
      const entry = all[entryIndex].close;
      for (const direction of ["long", "short"] as const) {
        const sign = direction === "long" ? 1 : -1;
        const pos: FreeTradePosition = { direction, entryIndex, entry, stop: entry - sign * 10, target: entry + sign * 25 };
        const exits = [
          { index: entryIndex + 1, price: pos.target, reason: "target" as const },
          { index: entryIndex + 1, price: pos.stop, reason: "stop" as const },
          { index: all.length - 1, price: all[all.length - 1].close, reason: "session_end" as const },
        ];
        for (const exit of exits) {
          // An open trade can't be marked below its stop (it would have exited there).
          if (exit.reason === "session_end" && sign * (exit.price - pos.stop) <= 0) continue;
          push(`${direction} ${exit.reason}`, buildFreeTradeAttempt(e, pos, exit, gradeFreeTrade(e, pos, exit), meta));
        }
      }
    }
  }
  return out;
}

beforeAll(async () => {
  db = await migratedDb();
  await seed(db, []);
});

describe("attempt integrity constraints", () => {
  it("accept every row the grading code produces", async () => {
    const rows = realRows();
    expect(rows.length).toBeGreaterThan(300);
    for (const { label, row } of rows) {
      await expect(insert(row).catch((e) => Promise.reject(new Error(`${label}: ${e.message}`)))).resolves.toBeUndefined();
    }
  });

  const zone = exercises.find((e) => e.exercise_id === "fvg-001")!;
  const good = () => buildAnswerAttempt(zone, { type: "none" }, gradeAttempt(zone, { type: "none" }), meta);

  it.each<[string, Partial<NewAttempt>, RegExp]>([
    ["an unknown concept", { concept: "SMT" }, /attempts_concept_valid/],
    ["a recognition row filed under GuidedEntry", { concept: "GuidedEntry" }, /attempts_concept_matches_mode/],
    ["a malformed exercise id", { exercise_id: "../../etc" }, /attempts_exercise_id_format/],
    ["a region answer with no box", { user_answer_type: "region" }, /attempts_answer_shape/],
    ["a guided answer on a zone exercise", { user_answer_type: "guided" }, /attempts_answer_shape/],
    ["guided fields on a zone attempt", { guided_bias_choice: "bullish" }, /attempts_foreign_fields_empty/],
    ["correct with a failure reason", { is_correct: true, failure_reason: "missed_answer" }, /attempts_failure_reason_consistent/],
    ["wrong with no failure reason", { is_correct: false, failure_reason: null }, /attempts_failure_reason_consistent/],
    ["a failure reason that doesn't fit the answer", { is_correct: false, failure_reason: "off_level" }, /attempts_failure_reason_consistent/],
    ["a negative response time", { response_time_ms: -5 }, /attempts_ranges/],
    ["a 3-day response time", { response_time_ms: 3 * 86400000 }, /attempts_ranges/],
    ["attempt number 0", { attempt_number: 0 }, /attempts_ranges/],
  ])("refuse %s", async (_label, patch, err) => {
    await expect(insert({ ...good(), ...patch } as NewAttempt)).rejects.toThrow(err);
  });

  it("refuse a choice marked correct for the wrong option", async () => {
    const c = exercises.find((e) => e.answer_type === "choice")!;
    if (c.answer_type !== "choice") throw new Error("fixture");
    const wrong = c.options.find((o) => o.value !== c.answer.correct_choice)!.value;
    const row = buildAnswerAttempt(c, { type: "choice", choice: wrong }, gradeAttempt(c, { type: "choice", choice: wrong }), meta);
    await expect(insert({ ...row, is_correct: true, failure_reason: null })).rejects.toThrow(/attempts_choice_consistent/);
  });

  it("refuse Guided Entry rows whose steps contradict the verdict", async () => {
    const g = exercises.find((e) => e.answer_type === "guided" && e.answer.is_valid_setup)!;
    if (g.answer_type !== "guided") throw new Error("fixture");
    const k = g.answer;
    const ans: GuidedUserAnswer = { bias: k.bias, entry: k.entry!.price, stop: k.stop!.price, target: k.target!.price, declaredTrade: true };
    const row = buildGuidedAttempt(g, ans, gradeGuidedAttempt(g, ans), meta);
    expect(row.is_correct).toBe(true);
    await expect(insert({ ...row, guided_stop_correct: false })).rejects.toThrow(/attempts_guided_consistent/);
    await expect(insert({ ...row, guided_entry_price: null, guided_entry_correct: null })).rejects.toThrow(/attempts_guided_consistent/);
    await expect(insert({ ...row, guided_achieved_rr: 5000 })).rejects.toThrow(/attempts_ranges/);
  });

  it("refuse Free Trade rows whose outcome or verdict contradicts the trade", async () => {
    const f = exercises.find((e) => e.answer_type === "free")!;
    if (f.answer_type !== "free") throw new Error("fixture");
    const none = buildFreeTradeAttempt(f, null, null, gradeFreeTrade(f, null, null), meta);
    await expect(insert({ ...none, free_outcome: "win" })).rejects.toThrow(/attempts_free_consistent/);
    await expect(insert({ ...none, is_correct: !none.is_correct })).rejects.toThrow(/attempts_free_consistent/);
    const entry = f.candles[f.candles.length - 1].close;
    const pos: FreeTradePosition = { direction: "long", entryIndex: f.candles.length - 1, entry, stop: entry - 10, target: entry + 25 };
    const exit = { index: pos.entryIndex + 1, price: pos.stop, reason: "stop" as const };
    const loss = buildFreeTradeAttempt(f, pos, exit, gradeFreeTrade(f, pos, exit), meta);
    await expect(insert({ ...loss, free_outcome: "win" })).rejects.toThrow(/attempts_free_consistent/);
    await expect(insert({ ...loss, free_result_r: -3 })).rejects.toThrow(/attempts_free_consistent|attempts_ranges/);
    await expect(insert({ ...loss, free_rr: -2 })).rejects.toThrow(/attempts_ranges/);
  });

  it("refuse malformed events", async () => {
    await expect(
      db.query(`insert into practice_events (user_id, event_type, concept) values ('${A}', 'session_started', 'Nope')`),
    ).rejects.toThrow(/practice_events_ranges/);
    await expect(
      db.query(`insert into practice_events (user_id, event_type, session_id) values ('${A}', 'recommendation_shown', 's1')`),
    ).rejects.toThrow(/practice_events_ranges/);
  });
});

describe("applying the constraints over existing data", () => {
  it("doesn't fail on historical rows that violate them: enforces for new rows and reports the rest", async () => {
    const MIGRATION = "20260927130000_attempt_integrity.sql";
    const old = await migratedDb({ before: MIGRATION });
    await seed(old, []);
    // The historical shape predicted in docs/DATA-INTEGRITY.md: a Liquidity
    // box drawn before 2026-09-10 (when Liquidity was a zone), migrated from
    // localStorage with today's answer_type 'level'.
    await old.exec(`insert into attempts (user_id, exercise_id, concept, answer_type, user_answer_type,
        user_price_low, user_price_high, user_candle_start, user_candle_end, coverage, precision_ratio,
        is_correct, failure_reason, response_time_ms, attempt_number)
      values ('${A}', 'liq-001', 'Liquidity', 'level', 'region', 100, 101, 3, 5, 0.2, 1.1, false, 'coverage', 3000, 1)`);
    await expect(applyMigrations(old, (f) => f >= MIGRATION)).resolves.toBeUndefined();
    const status = (await old.query(`select conname, convalidated from pg_constraint where conrelid = 'public.attempts'::regclass and conname like 'attempts\\_%' escape '\\' and contype = 'c' and conname in ('attempts_answer_shape', 'attempts_ranges')`)).rows;
    expect(status).toContainEqual({ conname: "attempts_answer_shape", convalidated: false });
    expect(status).toContainEqual({ conname: "attempts_ranges", convalidated: true });
    // The audit script finds exactly that row.
    const audit = fs.readFileSync(path.resolve(__dirname, "../../supabase/audit/attempt_integrity_audit.sql"), "utf8");
    const results = await old.exec(audit);
    const report = results[results.length - 1].rows;
    expect(report).toEqual([
      expect.objectContaining({ table_name: "attempts", constraint_name: "attempts_answer_shape", violating_rows: 1 }),
    ]);
    // Still enforced for new rows.
    await expect(
      old.exec(`insert into attempts (user_id, exercise_id, concept, answer_type, user_answer_type, is_correct, response_time_ms, attempt_number)
        values ('${A}', 'liq-001', 'Liquidity', 'level', 'region', false, 3000, 1)`),
    ).rejects.toThrow(/attempts_answer_shape/);
  });
});

describe("pre-login attempt migration (Bug Log 2026-09-27)", () => {
  it("records a 2026-09-09 Liquidity box as a zone answer, which the constraints accept", async () => {
    const { migrateLocalAttempts } = await import("@/lib/attempts");
    const base = {
      session_id: "local-1", concept: "Liquidity", is_correct: false, failure_reason: "coverage",
      user_price: null, distance_from_level: null, attempt_number: 1, timestamp: "2026-09-09T15:00:00Z",
    };
    await migrateLocalAttempts(A, [
      { ...base, attempt_id: "a1", exercise_id: "liq-001", user_answer_type: "region", user_price_low: 100, user_price_high: 101,
        user_candle_start: 3, user_candle_end: 5, coverage: 0.2, precision_ratio: 1.1, response_time_ms: 3 * 86_400_000 },
      { ...base, attempt_id: "a2", exercise_id: "liq-002", user_answer_type: "none", user_price_low: null, user_price_high: null,
        user_candle_start: null, user_candle_end: null, coverage: null, precision_ratio: null, failure_reason: "missed_answer", response_time_ms: 4000 },
    ]);
    const rows = captured.at(-1)!;
    expect(rows.map((r) => [r.answer_type, r.user_answer_type])).toEqual([["zone", "region"], ["level", "none"]]);
    expect(rows[0].response_time_ms).toBe(86_400_000);
    for (const r of rows) {
      const keys = Object.keys(r);
      await db.query(`insert into attempts (${keys.join(",")}) values (${keys.map((_, i) => `$${i + 1}`).join(",")})`, Object.values(r));
    }
  });
});
