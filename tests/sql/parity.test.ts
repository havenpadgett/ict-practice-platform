// The analytics page gets its numbers from the SQL views when they exist and
// from src/lib/analytics.ts otherwise. Both paths must agree.

import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import type { DbAttempt } from "@/lib/attempts";
import { aggregatesFromAttempts, aggregatesFromViews, type ViewRows } from "@/lib/analytics-views";
import { A, B, migratedDb, seed } from "./db";

let db: PGlite;

beforeAll(async () => {
  db = await migratedDb();
  const rows = [];
  const exercises = [
    ["fvg-001", "FVG", "zone"], ["fvg-002", "FVG", "zone"], ["real-fvg-003", "FVG", "zone"],
    ["mss-001", "MSS", "level"], ["real-mss-002", "MSS", "level"], ["pd-001", "PremiumDiscount", "choice"],
  ] as const;
  let m = 0;
  for (let i = 0; i < 60; i++) {
    const [exercise, concept, answer_type] = exercises[i % exercises.length];
    rows.push({ exercise, concept, answer_type, correct: (i * 7) % 5 < 3, difficulty: (i % 3) + 1, ms: 2000 + ((i * 131) % 9000), at: new Date(Date.UTC(2026, 8, 1, 0, m++)).toISOString() });
  }
  for (let i = 0; i < 8; i++) {
    rows.push({ exercise: `guided-00${(i % 5) + 1}`, concept: "GuidedEntry", answer_type: "guided", correct: i % 3 === 0, at: new Date(Date.UTC(2026, 8, 2, 0, m++)).toISOString(),
      extra: { guided_bias_correct: i % 2 === 0, guided_entry_correct: i < 6 ? i % 3 !== 1 : null, guided_stop_correct: i < 4 ? true : null, guided_target_correct: i < 2 ? false : null } });
    rows.push({ exercise: `ft-00${(i % 5) + 1}`, concept: "FreeTrade", answer_type: "free", correct: i % 2 === 0, at: new Date(Date.UTC(2026, 8, 3, 0, m++)).toISOString(),
      extra: { free_outcome: ["win", "loss", "open", "no_trade"][i % 4], free_result_r: i % 4 === 0 ? 2 : -1 } });
  }
  rows.push({ user: B, correct: true, at: new Date(Date.UTC(2026, 8, 4)).toISOString() });
  await seed(db, rows);
});

async function view<T>(sql: string): Promise<T[]> {
  return (await db.query(sql)).rows as T[];
}

describe("views and browser computation agree", () => {
  it("for every aggregate the analytics page shows", async () => {
    const attempts = ((await db.query(`select * from attempts where user_id = '${A}' order by created_at`)).rows as Record<string, unknown>[]).map(
      (r) => ({ ...r, created_at: (r.created_at as Date).toISOString() }) as unknown as DbAttempt,
    );
    const u = `where user_id = '${A}'`;
    const rows: ViewRows = {
      concept: await view(`select * from v_accuracy_by_concept ${u}`),
      conceptDifficulty: await view(`select * from v_accuracy_by_concept_difficulty ${u}`),
      // As user A, RLS limits this view to A's attempts; here (service
      // role) restrict it the same way for the comparison.
      exercise: await view(`select exercise_id, concept, count(*) as attempts, count(*) filter (where is_correct) as correct from attempts ${u} group by 1, 2`),
      realVsConstructed: await view(`select * from v_real_vs_constructed ${u}`),
      guided: await view(`select * from v_guided_step_accuracy ${u}`),
      freeTrade: await view(`select * from v_free_trade_process_vs_outcome ${u}`),
      responseTime: await view(`select * from v_response_time ${u}`),
    };
    const js = aggregatesFromAttempts(attempts);
    const sql = aggregatesFromViews(rows);
    expect({ ...sql, source: "", byExercise: [] }).toEqual({ ...js, source: "", byExercise: [] });
    const exA = js.byExercise;
    const exB = sql.byExercise;
    const key = (e: { exerciseId: string; total: number; missed: number }) => `${e.exerciseId}:${e.total}:${e.missed}`;
    expect(exB.map(key).sort()).toEqual(exA.map(key).sort());
  });
});
