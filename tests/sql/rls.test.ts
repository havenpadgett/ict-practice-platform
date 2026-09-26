// Security audit S8: Row Level Security, checked table by table and view
// by view, as two real users (A and B) through the `authenticated` role
// PostgREST uses. Also S1 (nobody can grant themselves a role) and S3
// (graded attempts can't be rewritten).

import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { A, asUser, B, migratedDb, seed } from "./db";

let db: PGlite;
const at = (h: number) => new Date(Date.UTC(2026, 8, 1, h)).toISOString();
const q = async (sql: string) => (await db.query(sql)).rows as Record<string, unknown>[];
const affected = async (sql: string) => (await db.query(sql)).affectedRows ?? 0;

beforeAll(async () => {
  db = await migratedDb();
  await seed(db, [
    { user: A, correct: true, session: "sa", at: at(1) },
    { user: B, correct: false, session: "sb", at: at(2), answer_type: "guided", concept: "GuidedEntry", exercise: "guided-001", extra: { guided_bias_correct: false } },
  ]);
  await db.exec(`
    insert into practice_events (user_id, session_id, event_type, mode, source, planned_length, created_at) values
      ('${A}', 'sa', 'session_started', 'recognition', 'picker', 5, '${at(1)}'),
      ('${B}', 'sb', 'session_started', 'guided_entry', 'picker', 5, '${at(2)}');
  `);
});

describe("RLS: user A cannot touch user B's rows", () => {
  for (const [table, owner] of [
    ["profiles", "id"],
    ["attempts", "user_id"],
    ["practice_events", "user_id"],
  ] as const) {
    it(`${table}: select sees only own rows`, async () => {
      const rows = await asUser(db, A, () => q(`select ${owner} as owner from ${table}`));
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.every((r) => r.owner === A)).toBe(true);
      expect(await asUser(db, A, () => q(`select 1 from ${table} where ${owner} = '${B}'`))).toEqual([]);
    });

    it(`${table}: cannot delete B's rows`, async () => {
      expect(await asUser(db, A, () => affected(`delete from ${table} where ${owner} = '${B}'`))).toBe(0);
      expect((await q(`select count(*)::int as n from ${table} where ${owner} = '${B}'`))[0].n).toBeGreaterThan(0);
    });
  }

  it("profiles: cannot update B's profile", async () => {
    expect(await asUser(db, A, () => affected(`update profiles set username = 'x' where id = '${B}'`))).toBe(0);
  });

  it("practice_events: no updates at all", async () => {
    expect(await asUser(db, A, () => affected(`update practice_events set position = 99 where user_id = '${A}'`))).toBe(0);
  });

  it("attempts and events: cannot insert rows claiming to be B", async () => {
    await expect(
      asUser(db, A, () =>
        q(`insert into attempts (user_id, exercise_id, concept, answer_type, user_answer_type, is_correct, response_time_ms, attempt_number)
           values ('${B}', 'fvg-001', 'FVG', 'zone', 'none', true, 1000, 1)`),
      ),
    ).rejects.toThrow(/row-level security/);
    await expect(
      asUser(db, A, () => q(`insert into practice_events (user_id, event_type) values ('${B}', 'session_started')`)),
    ).rejects.toThrow(/row-level security/);
  });

  it("every analytics view returns only A's rows", async () => {
    const views = (await q(`select table_name from information_schema.views where table_schema = 'public'`)).map((r) => String(r.table_name));
    expect(views.length).toBeGreaterThanOrEqual(16);
    for (const v of views) {
      const cols = (await q(`select column_name from information_schema.columns where table_name = '${v}'`)).map((r) => r.column_name);
      if (!cols.includes("user_id")) continue;
      const rows = await asUser(db, A, () => q(`select user_id from ${v}`));
      expect(rows.every((r) => r.user_id === A), v).toBe(true);
    }
    // A view with no user_id column still only aggregates A's rows.
    expect(await asUser(db, A, () => q(`select exercise_id from v_exercise_success`))).toEqual([{ exercise_id: "fvg-001" }]);
  });

  it("anon (signed out) sees nothing", async () => {
    await db.exec(`set role anon`);
    try {
      for (const t of ["profiles", "attempts", "practice_events"]) {
        const rows = await q(`select 1 from ${t}`).catch(() => []);
        expect(rows, t).toEqual([]);
      }
    } finally {
      await db.exec(`reset role`);
    }
  });
});

describe("roles (S1) and graded attempts (S3)", () => {
  it("a user cannot grant themselves a role, by update or by insert", async () => {
    await expect(asUser(db, A, () => q(`update profiles set role = 'admin' where id = '${A}'`))).rejects.toThrow(/administrator/);
    await db.exec(`delete from attempts where user_id = '${B}'; delete from practice_events where user_id = '${B}'; delete from profiles where id = '${B}';`);
    await expect(asUser(db, B, () => q(`insert into profiles (id, role) values ('${B}', 'reviewer')`))).rejects.toThrow(/administrator/);
    // Ordinary profile writes still work.
    expect(await asUser(db, B, () => affected(`insert into profiles (id, username) values ('${B}', 'b')`))).toBe(1);
    expect(await asUser(db, A, () => affected(`update profiles set current_streak = 3 where id = '${A}'`))).toBe(1);
    expect(await asUser(db, A, () => q(`select public.is_admin() as a, public.is_reviewer() as r`))).toEqual([{ a: false, r: false }]);
  });

  it("the SQL editor (not an API role) can grant roles", async () => {
    await db.exec(`update profiles set role = 'reviewer' where id = '${A}'`);
    expect(await asUser(db, A, () => q(`select public.current_role_name() as role, public.is_reviewer() as r, public.is_admin() as a`))).toEqual([
      { role: "reviewer", r: true, a: false },
    ]);
    await db.exec(`update profiles set role = 'user' where id = '${A}'`);
  });

  it("a user cannot rewrite a graded attempt", async () => {
    expect(await asUser(db, A, () => affected(`update attempts set is_correct = false where user_id = '${A}'`))).toBe(0);
    expect(await q(`select is_correct from attempts where user_id = '${A}'`)).toEqual([{ is_correct: true }]);
  });
});
