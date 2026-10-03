// 20261003130000_profile_experience.sql: the experience preference column.

import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { A, asUser, migratedDb, seed } from "./db";

let db: PGlite;
beforeAll(async () => {
  db = await migratedDb();
  await seed(db, [{ correct: true, at: "2026-09-01T10:00:00Z" }]);
}, 60_000);
afterAll(async () => {
  await db.close();
});

describe("profiles.experience_level", () => {
  it("starts unset", async () => {
    const r = await db.query(`select experience_level from profiles where id = '${A}'`);
    expect(r.rows).toEqual([{ experience_level: null }]);
  });

  it("takes beginner or experienced, and clears back to null", async () => {
    for (const v of ["beginner", "experienced"]) {
      await db.query(`update profiles set experience_level = $1 where id = '${A}'`, [v]);
      expect((await db.query(`select experience_level from profiles where id = '${A}'`)).rows).toEqual([{ experience_level: v }]);
    }
    await db.query(`update profiles set experience_level = null where id = '${A}'`);
  });

  it("refuses anything else", async () => {
    await expect(db.query(`update profiles set experience_level = 'expert' where id = '${A}'`)).rejects.toThrow(/experience_level_check/);
  });

  it("is the user's own to change, through their own session", async () => {
    await asUser(db, A, async () => {
      await db.query(`update profiles set experience_level = 'experienced' where id = '${A}'`);
    });
    expect((await db.query(`select experience_level from profiles where id = '${A}'`)).rows).toEqual([{ experience_level: "experienced" }]);
  });
});
