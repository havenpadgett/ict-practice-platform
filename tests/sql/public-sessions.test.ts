// 20261003140000_session_progress_practice_only.sql: answers given through a
// shared challenge or the daily challenge are attempts (they count toward
// accuracy) but not practice sessions (they don't read as sessions
// abandoned after one answer).

import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { migratedDb, seed } from "./db";

let db: PGlite;
const q = async (sql: string) => (await db.query(sql)).rows as Record<string, unknown>[];
const t = (m: number) => new Date(Date.UTC(2026, 9, 1, 0, m)).toISOString();

beforeAll(async () => {
  db = await migratedDb();
  await seed(db, [
    { correct: true, at: t(0), session: "session_a" },
    { correct: false, at: t(1), session: "session_a" },
    { correct: true, at: t(2), session: "session_a" },
    { correct: true, at: t(10), session: "challenge:fvg-001", exercise: "fvg-001" },
    { correct: false, at: t(20), session: "daily:2026-10-01", exercise: "fvg-002" },
  ]);
}, 60_000);
afterAll(async () => {
  await db.close();
});

describe("public-link attempts", () => {
  it("count toward accuracy like any attempt", async () => {
    const [r] = await q(`select attempts, correct from v_accuracy_by_concept where concept = 'FVG'`);
    expect(r).toEqual({ attempts: 5, correct: 3 });
  });

  it("are not sessions in the progress or drop-off views", async () => {
    expect(await q(`select session_id, exercises_answered from v_session_progress order by session_id`)).toEqual([{ session_id: "session_a", exercises_answered: 3 }]);
    expect(await q(`select exercises_answered, sessions from v_session_dropoff`)).toEqual([{ exercises_answered: 3, sessions: 1 }]);
  });
});
