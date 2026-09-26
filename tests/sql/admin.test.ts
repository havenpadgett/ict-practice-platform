import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { A, asUser, B, migratedDb, seed } from "./db";

let db: PGlite;
const at = (h: number) => new Date(Date.UTC(2026, 8, 1, h)).toISOString();

beforeAll(async () => {
  db = await migratedDb();
  await seed(db, [
    // fvg-001: 6 attempts, 1 correct, 2 users. mss-001: 5 of 5. liq-001: 2 attempts (under the floor).
    ...Array.from({ length: 6 }, (_, i) => ({ user: i % 2 ? A : B, exercise: "fvg-001", correct: i === 0, at: at(i) })),
    ...Array.from({ length: 5 }, (_, i) => ({ user: B, exercise: "mss-001", concept: "MSS", correct: true, at: at(10 + i) })),
    { user: B, exercise: "liq-001", concept: "Liquidity", correct: false, at: at(20) },
    { user: B, exercise: "liq-001", concept: "Liquidity", correct: false, at: at(21) },
  ]);
  await db.exec(`
    insert into practice_events (user_id, session_id, event_type, mode, concept, source, planned_length, created_at) values
      ('${A}', 's1', 'session_started', 'recognition', 'FVG', 'picker', 5, '${at(0)}'),
      ('${B}', 's2', 'session_started', 'recognition', 'MSS', 'picker', 5, '${at(10)}');
    insert into practice_events (user_id, session_id, event_type, position, created_at) values
      ('${B}', 's2', 'session_completed', 5, '${at(15)}');
    insert into app_admins (user_id) values ('${A}');
  `);
});

const q = async (sql: string) => (await db.query(sql)).rows as Record<string, unknown>[];

describe("admin functions", () => {
  it("refuse anyone not in app_admins", async () => {
    await asUser(db, B, async () => {
      expect((await q(`select public.is_admin() as ok`))[0].ok).toBe(false);
      await expect(q(`select * from admin_overview()`)).rejects.toThrow(/admin only/);
      await expect(q(`select * from admin_exercise_failures()`)).rejects.toThrow(/admin only/);
      await expect(q(`select * from admin_concept_ranking()`)).rejects.toThrow(/admin only/);
    });
  });

  it("app_admins isn't readable through the API", async () => {
    await asUser(db, A, async () => {
      expect(await q(`select * from app_admins`)).toEqual([]);
    });
  });

  it("overview counts every user's rows, despite RLS", async () => {
    const [o] = await asUser(db, A, () => q(`select * from admin_overview()`));
    expect(o).toMatchObject({
      total_users: 2,
      total_attempts: 13,
      overall_accuracy: "0.462",
      sessions_started: 2,
      sessions_completed: 1,
      completion_rate: "0.500",
    });
  });

  it("most-failed exercises: lowest success first, small samples left out", async () => {
    const rows = await asUser(db, A, () => q(`select exercise_id, attempts, users, success_rate from admin_exercise_failures(5, 10)`));
    expect(rows).toEqual([
      { exercise_id: "fvg-001", attempts: 6, users: 2, success_rate: "0.167" },
      { exercise_id: "mss-001", attempts: 5, users: 1, success_rate: "1.000" },
    ]);
  });

  it("concept ranking: hardest first", async () => {
    const rows = await asUser(db, A, () => q(`select concept, attempts, accuracy, difficulty_rank from admin_concept_ranking()`));
    expect(rows.map((r) => r.concept)).toEqual(["Liquidity", "FVG", "MSS"]);
    expect(rows[0]).toMatchObject({ attempts: 2, accuracy: "0.000", difficulty_rank: 1 });
  });
});
