// scripts/backup.ts / restore.ts round trip (docs/OPERATIONS.md): export a
// populated database, restore into a freshly migrated one, get the same data.

import { describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { exportAll, restoreAll, type Query } from "../../scripts/lib/backup-core";
import { A, B, migratedDb, seed } from "./db";

const query = (db: PGlite): Query => async (sql, params) => (await db.query(sql, params)).rows as Record<string, unknown>[];
const at = (h: number) => new Date(Date.UTC(2026, 8, 1, h)).toISOString();

async function populated(): Promise<PGlite> {
  const db = await migratedDb();
  await seed(db, [
    { user: A, correct: true, session: "sa", at: at(1) },
    { user: A, correct: false, answer_type: "guided", concept: "GuidedEntry", exercise: "guided-001", session: "sa", at: at(2), extra: { guided_entry_correct: false } },
    { user: B, correct: true, answer_type: "free", concept: "FreeTrade", exercise: "ft-001", session: "sb", at: at(3), extra: { free_outcome: "win", free_result_r: 2.5 } },
  ]);
  await db.exec(`
    update profiles set role = 'admin', current_streak = 4 where id = '${A}';
    insert into practice_events (user_id, session_id, event_type, mode, concept, source, planned_length, created_at)
      values ('${A}', 'sa', 'session_started', 'recognition', 'FVG', 'picker', 5, '${at(1)}');
    insert into practice_events (user_id, event_type, recommended_concept, recommended_difficulty, created_at)
      values ('${B}', 'recommendation_shown', 'MSS', 2, '${at(0)}');
  `);
  return db;
}

describe("backup and restore", () => {
  it("round-trips every table, roles included, and re-running inserts nothing", async () => {
    const source = await populated();
    const backup = await exportAll(query(source));
    expect(backup.row_counts).toEqual({ "auth.users": 2, "public.profiles": 2, "public.attempts": 3, "public.practice_events": 2 });

    const target = await migratedDb();
    // Through JSON, exactly as the file on disk.
    const fromFile = JSON.parse(JSON.stringify(backup));
    expect(await restoreAll(query(target), fromFile, { replica: true })).toEqual(backup.row_counts);

    const again = await exportAll(query(target));
    expect(again.tables).toEqual(backup.tables);
    expect(await restoreAll(query(target), fromFile, { replica: true })).toEqual({
      "auth.users": 0, "public.profiles": 0, "public.attempts": 0, "public.practice_events": 0,
    });
  });

  it("refuses a file that isn't a backup, and a target without the schema", async () => {
    const target = await migratedDb();
    await expect(restoreAll(query(target), { format: "x" } as never, { replica: false })).rejects.toThrow(/Not an ict-practice backup/);
    const source = await populated();
    const backup = await exportAll(query(source));
    await target.exec(`drop table practice_events cascade`);
    await expect(restoreAll(query(target), backup, { replica: false })).rejects.toThrow(/Apply the migrations first/);
  });
});
