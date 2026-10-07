// 20261006120000_scenario_attempts.sql: the engine's attempt table, its
// integrity constraints, row level security, and the three views, on the real SQL.

import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { A, B, asUser, migratedDb } from "./db";

let db: PGlite;
const q = async (sql: string) => (await db.query(sql)).rows as Record<string, unknown>[];

type Row = Partial<{
  user: string;
  mode: string;
  score: number;
  verdict: string;
  decision: string | null;
  noTrade: boolean;
  avoidance: boolean | null;
  confidence: number | null;
  outcome: string;
  r: number | null;
  mistakes: string[];
  at: string;
}>;

async function insert(r: Row): Promise<void> {
  const outcome = r.outcome ?? "target";
  const result = r.r === undefined ? (["stop", "target", "scenario_end"].includes(outcome) ? 1.5 : null) : r.r;
  await db.query(
    `insert into scenario_attempts (user_id, scenario_id, mode_id, difficulty, scenario_type, score, verdict, decision, no_trade_scenario, correct_avoidance, confidence, outcome, result_r, mistakes, response, created_at)
     values ($1, 'sim-001', $2, 2, 'valid_setup', $3, $4, $5, $6, $7, $8, $9, $10, $11, '{}'::jsonb, $12)`,
    [r.user ?? A, r.mode ?? "simulator", r.score ?? 80, r.verdict ?? "correct", r.decision === undefined ? "long" : r.decision, r.noTrade ?? false, r.avoidance ?? null, r.confidence === undefined ? null : r.confidence, outcome, result, r.mistakes ?? [], r.at ?? "2026-10-06T10:00:00Z"],
  );
}

beforeAll(async () => {
  db = await migratedDb();
  await db.exec(`insert into auth.users (id, email) values ('${A}', 'a@example.com'), ('${B}', 'b@example.com') on conflict do nothing;
    insert into public.profiles (id) values ('${A}'), ('${B}') on conflict do nothing;`);
  await insert({ mistakes: ["PREMATURE_ENTRY", "STOP_TOO_TIGHT"], confidence: 5, score: 40, verdict: "incorrect", at: "2026-10-06T10:00:00Z" });
  await insert({ mistakes: ["PREMATURE_ENTRY"], confidence: 5, score: 50, verdict: "incorrect", at: "2026-10-06T10:01:00Z" });
  await insert({ mistakes: [], confidence: 2, score: 90, at: "2026-10-06T10:02:00Z" });
  await insert({ noTrade: true, avoidance: true, decision: "no_trade", outcome: "no_order", at: "2026-10-06T10:03:00Z" });
  await insert({ noTrade: true, avoidance: false, decision: "long", outcome: "stop", r: -1, mistakes: ["FORCED_SETUP"], at: "2026-10-06T10:04:00Z" });
  await insert({ decision: "no_trade", outcome: "no_order", at: "2026-10-06T10:05:00Z" });
  await insert({ user: B, mistakes: ["WRONG_DRAW"], at: "2026-10-06T10:06:00Z" });
}, 60_000);

afterAll(async () => {
  await db.close();
});

describe("scenario_attempts constraints", () => {
  it("rejects a score outside 0-100, an unknown mode, verdict, mistake or confidence", async () => {
    await expect(insert({ score: 101 })).rejects.toThrow(/score_range/);
    await expect(insert({ mode: "leaderboard" })).rejects.toThrow(/scenario_attempts_mode/);
    await expect(insert({ verdict: "great" })).rejects.toThrow(/verdict/);
    await expect(insert({ mistakes: ["BAD_VIBES"] })).rejects.toThrow(/mistake_ids/);
    await expect(insert({ confidence: 6 })).rejects.toThrow(/confidence/);
  });

  it("keeps R and outcome consistent: a closed trade has an R, anything else has none", async () => {
    await expect(insert({ outcome: "target", r: null })).rejects.toThrow(/r_consistent/);
    await expect(insert({ outcome: "no_order", r: 2 })).rejects.toThrow(/r_consistent/);
  });

  it("only defines correct avoidance on a no-trade scenario", async () => {
    await expect(insert({ noTrade: false, avoidance: true })).rejects.toThrow(/avoidance/);
  });

  it("is a record: no update, no delete", async () => {
    await asUser(db, A, async () => {
      await db.query(`update scenario_attempts set score = 0 where user_id = '${A}'`);
      await db.query(`delete from scenario_attempts where user_id = '${A}'`);
    });
    const [r] = await q(`select count(*)::int as n from scenario_attempts where user_id = '${A}'`);
    expect(r.n).toBe(6);
  });
});

describe("row level security", () => {
  it("a user reads only their own rows", async () => {
    const rows = await asUser(db, B, async () => q(`select user_id from scenario_attempts`));
    expect(rows.every((r) => r.user_id === B)).toBe(true);
    expect(rows).toHaveLength(1);
  });

  it("a user cannot insert a row for someone else", async () => {
    await expect(
      asUser(db, B, async () => {
        await db.query(`insert into scenario_attempts (user_id, scenario_id, mode_id, difficulty, scenario_type, score, verdict, outcome, response) values ('${A}', 'x', 'simulator', 1, 'chop', 50, 'incorrect', 'no_order', '{}')`);
      }),
    ).rejects.toThrow();
  });
});

describe("views", () => {
  it("v_mistake_counts: counts per structured mistake", async () => {
    const rows = await q(`select mistake, occurrences::int as n from v_mistake_counts where user_id = '${A}' order by occurrences desc, mistake`);
    expect(rows).toEqual([
      { mistake: "PREMATURE_ENTRY", n: 2 },
      { mistake: "FORCED_SETUP", n: 1 },
      { mistake: "STOP_TOO_TIGHT", n: 1 },
    ]);
  });

  it("v_scenario_calibration: confidence on the 1-5 scale against process score", async () => {
    const rows = await q(`select confidence::int as c, attempts::int as n, avg_score::float as avg, incorrect::int as bad from v_scenario_calibration where user_id = '${A}' order by confidence`);
    expect(rows).toEqual([
      { c: 2, n: 1, avg: 90, bad: 0 },
      { c: 5, n: 2, avg: 45, bad: 2 },
    ]);
  });

  it("v_correct_avoidance: no-trade charts avoided, and valid setups skipped", async () => {
    const [r] = await q(`select no_trade_attempts::int as nt, avoided::int as av, setup_attempts::int as sa, skipped_setups::int as sk from v_correct_avoidance where user_id = '${A}'`);
    expect(r).toEqual({ nt: 2, av: 1, sa: 4, sk: 1 });
  });

  it("the views respect row level security", async () => {
    const rows = await asUser(db, B, async () => q(`select distinct user_id from v_mistake_counts`));
    expect(rows).toEqual([{ user_id: B }]);
  });
});
