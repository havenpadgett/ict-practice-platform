// 20261003120000_attempt_confidence.sql: the optional confidence rating
// and its calibration view, on the real SQL.

import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { A, B, asUser, migratedDb, seed } from "./db";

let db: PGlite;
const q = async (sql: string) => (await db.query(sql)).rows as Record<string, unknown>[];

beforeAll(async () => {
  db = await migratedDb();
  await seed(db, [
    { correct: true, at: "2026-09-01T10:00:00Z", extra: { confidence: 3 } },
    { correct: false, at: "2026-09-01T10:01:00Z", extra: { confidence: 3 } },
    { correct: false, at: "2026-09-01T10:02:00Z", extra: { confidence: 3 } },
    { correct: true, at: "2026-09-01T10:03:00Z", extra: { confidence: 1 } },
    { correct: false, at: "2026-09-01T10:04:00Z" }, // skipped
    { user: B, correct: true, at: "2026-09-01T10:05:00Z", extra: { confidence: 2 } },
  ]);
}, 60_000);

afterAll(async () => {
  await db.close();
});

describe("attempt confidence", () => {
  it("is optional: an attempt without a rating is stored", async () => {
    const [r] = await q(`select count(*)::int as n from attempts where user_id = '${A}' and confidence is null`);
    expect(r.n).toBe(1);
  });

  it("only accepts 1 to 3", async () => {
    for (const bad of [0, 4, -1]) {
      await expect(seed(db, [{ correct: true, at: "2026-09-02T10:00:00Z", extra: { confidence: bad } }])).rejects.toThrow(/attempts_confidence_range/);
    }
  });

  it("calibration view: accuracy per level, skipped attempts left out", async () => {
    const rows = await q(`select confidence, attempts, correct, wrong, accuracy from v_confidence_calibration where user_id = '${A}' order by confidence`);
    expect(rows).toEqual([
      { confidence: 1, attempts: 1, correct: 1, wrong: 0, accuracy: "1.000" },
      { confidence: 3, attempts: 3, correct: 1, wrong: 2, accuracy: "0.333" },
    ]);
  });

  it("row level security still applies through the view", async () => {
    const rows = await asUser(db, B, async () => q(`select distinct user_id from v_confidence_calibration`));
    expect(rows).toEqual([{ user_id: B }]);
  });
});
