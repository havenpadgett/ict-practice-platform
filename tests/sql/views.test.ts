import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { A, asUser, B, migratedDb, seed } from "./db";

let db: PGlite;
const t = (m: number) => new Date(Date.UTC(2026, 8, 1, 0, m)).toISOString();

beforeAll(async () => {
  db = await migratedDb();
  const rows = [];
  // User A: 25 FVG attempts, first 20 half right, last 5 all right.
  for (let i = 0; i < 25; i++) rows.push({ correct: i >= 20 || i % 2 === 0, at: t(i), difficulty: i < 10 ? 1 : 2, ms: i % 2 === 0 ? 4000 : 9000, session: i < 10 ? "s1" : i < 15 ? "s2" : "s3" });
  // User A: real vs constructed MSS.
  rows.push({ concept: "MSS", exercise: "real-mss-001", correct: false, at: t(30), session: "s4" });
  rows.push({ concept: "MSS", exercise: "mss-001", correct: true, at: t(31), session: "s4" });
  // User A: Guided Entry — bias right, entry wrong, stop/target never reached.
  rows.push({ concept: "GuidedEntry", exercise: "guided-001", answer_type: "guided", correct: false, at: t(32), session: "s4",
    extra: { guided_bias_correct: true, guided_entry_correct: false } });
  // User A: Free Trade — good process loss, bad process win.
  rows.push({ concept: "FreeTrade", exercise: "ft-001", answer_type: "free", correct: true, at: t(33), session: "s4", extra: { free_outcome: "loss", free_result_r: -1 } });
  rows.push({ concept: "FreeTrade", exercise: "ft-002", answer_type: "free", correct: false, at: t(34), session: "s4", extra: { free_outcome: "win", free_result_r: 2.5 } });
  // User B: 3 FVG attempts, all wrong.
  for (let i = 0; i < 3; i++) rows.push({ user: B, correct: false, at: t(40 + i), session: "sb" });
  await seed(db, rows);
});

const q = async (sql: string) => (await db.query(sql)).rows as Record<string, unknown>[];

describe("analytics views (run as the service role: every user)", () => {
  it("accuracy by concept, per user", async () => {
    const rows = await q(`select user_id, concept, attempts, accuracy from v_accuracy_by_concept where concept = 'FVG' order by user_id`);
    expect(rows).toEqual([
      { user_id: A, concept: "FVG", attempts: 25, accuracy: "0.600" },
      { user_id: B, concept: "FVG", attempts: 3, accuracy: "0.000" },
    ]);
  });

  it("accuracy by difficulty within a concept", async () => {
    const rows = await q(`select difficulty, attempts from v_accuracy_by_concept_difficulty where user_id = '${A}' and concept = 'FVG' order by difficulty`);
    expect(rows).toEqual([{ difficulty: 1, attempts: 10 }, { difficulty: 2, attempts: 15 }]);
  });

  it("improvement in blocks of 20", async () => {
    const rows = await q(`select block_number, attempts, accuracy from v_improvement_blocks where user_id = '${A}' order by block_number`);
    expect(rows[0]).toEqual({ block_number: 1, attempts: 20, accuracy: "0.500" });
    expect(rows[1].attempts).toBe(10);
  });

  it("exercise success, hardest first across users", async () => {
    const rows = await q(`select exercise_id, users, success_rate, is_real from v_exercise_success order by hardness_rank, exercise_id`);
    expect(rows[0]).toMatchObject({ exercise_id: "ft-002", success_rate: "0.000" });
    expect(rows.find((r) => r.exercise_id === "fvg-001")).toMatchObject({ users: 2 });
    expect(rows.find((r) => r.exercise_id === "real-mss-001")).toMatchObject({ is_real: true });
  });

  it("real vs constructed", async () => {
    const rows = await q(`select source, accuracy from v_real_vs_constructed where user_id = '${A}' and concept = 'MSS' order by source`);
    expect(rows).toEqual([{ source: "constructed", accuracy: "1.000" }, { source: "real", accuracy: "0.000" }]);
  });

  it("Guided Entry per step, only steps reached", async () => {
    const rows = await q(`select step, reached, accuracy from v_guided_step_accuracy where user_id = '${A}' order by step_order`);
    expect(rows).toEqual([{ step: "bias", reached: 1, accuracy: "1.000" }, { step: "entry", reached: 1, accuracy: "0.000" }]);
  });

  it("Free Trade process vs outcome", async () => {
    const [r] = await q(`select process_pass_rate, win_rate, good_process_losses, bad_process_wins, total_r from v_free_trade_process_vs_outcome where user_id = '${A}'`);
    expect(r).toEqual({ process_pass_rate: "0.500", win_rate: "0.500", good_process_losses: 1, bad_process_wins: 1, total_r: "1.50" });
  });

  it("response time, correct vs incorrect", async () => {
    const rows = await q(`select is_correct, median_ms from v_response_time where user_id = '${A}' and concept = 'FVG' order by is_correct`);
    expect(rows.map((r) => r.is_correct)).toEqual([false, true]);
    expect(rows[1].median_ms).toBe(4000);
  });

  it("session drop-off distribution", async () => {
    const rows = await q(`select exercises_answered, sessions from v_session_dropoff order by exercises_answered`);
    expect(rows).toEqual([
      { exercises_answered: 3, sessions: 1 },
      { exercises_answered: 5, sessions: 2 },
      { exercises_answered: 10, sessions: 2 },
    ]);
  });
});

describe("row level security through the views", () => {
  it("a signed-in user sees only their own rows", async () => {
    const rows = await asUser(db, B, () => q(`select distinct user_id from v_accuracy_by_concept`));
    expect(rows).toEqual([{ user_id: B }]);
    const direct = await asUser(db, B, () => q(`select count(*)::int as n from attempts where user_id = '${A}'`));
    expect(direct).toEqual([{ n: 0 }]);
    const ex = await asUser(db, B, () => q(`select exercise_id, users from v_exercise_success`));
    expect(ex).toEqual([{ exercise_id: "fvg-001", users: 1 }]);
  });
});
