// "Report a question" (supabase/migrations/20260927150000_question_reports.sql,
// widened by 20260928120000_report_reasons_app_version.sql):
// users file reports as themselves under RLS; only admins see counts, flags
// and notes, and only they can resolve reports.

import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { A, asUser, B, migratedDb, seed } from "./db";

let db: PGlite;
const at = (h: number) => new Date(Date.UTC(2026, 8, 1, 0, h)).toISOString();
const q = async (sql: string) => (await db.query(sql)).rows as Record<string, unknown>[];
const report = (reason: string, exercise = "fvg-001", note: string | null = null) =>
  q(`insert into question_reports (exercise_id, reason, note, stage, session_id) values ('${exercise}', '${reason}', ${note === null ? "null" : `'${note}'`}, 'feedback', 's1') returning user_id`);

beforeAll(async () => {
  db = await migratedDb();
  await seed(db, [
    // fvg-005: 2 of 12 right. The rest of FVG: 18 of 20 right. Anomalous.
    ...Array.from({ length: 12 }, (_, i) => ({ user: i % 2 ? A : B, exercise: "fvg-005", correct: i < 2, at: at(i) })),
    ...Array.from({ length: 20 }, (_, i) => ({ user: B, exercise: i % 2 ? "fvg-001" : "fvg-002", correct: i >= 2, at: at(20 + i) })),
    // mss-001: 8 of 12 right, the rest of MSS 10 of 12. Lower, but not by enough.
    ...Array.from({ length: 12 }, (_, i) => ({ user: A, exercise: "mss-001", concept: "MSS", correct: i < 8, at: at(40 + i) })),
    ...Array.from({ length: 12 }, (_, i) => ({ user: A, exercise: "mss-002", concept: "MSS", correct: i < 10, at: at(52 + i) })),
  ]);
  await db.exec(`update profiles set role = 'admin' where id = '${A}';`);
});

describe("question_reports", () => {
  it("users file reports as themselves and see only their own", async () => {
    const [row] = await asUser(db, B, () => report("answer_wrong"));
    expect(row.user_id).toBe(B);
    await asUser(db, A, () => report("chart_unclear"));
    expect(await asUser(db, A, () => q(`select user_id from question_reports`))).toEqual([{ user_id: A }]);
  });

  it("can't file as someone else, pre-resolve, or edit a report", async () => {
    await expect(
      asUser(db, A, () => q(`insert into question_reports (user_id, exercise_id, reason, stage) values ('${B}', 'fvg-001', 'technical', 'exercise')`)),
    ).rejects.toThrow(/row-level security/);
    await expect(
      asUser(db, A, () => q(`insert into question_reports (exercise_id, reason, stage, status) values ('fvg-001', 'technical', 'exercise', 'resolved')`)),
    ).rejects.toThrow(/row-level security/);
    const n = await asUser(db, A, async () => (await db.query(`update question_reports set reason = 'other', note = 'x'`)).affectedRows);
    expect(n).toBe(0);
  });

  it("checks the reason, and needs a note for 'other'", async () => {
    await expect(asUser(db, A, () => report("nonsense"))).rejects.toThrow(/check/);
    await expect(asUser(db, A, () => report("other"))).rejects.toThrow(/other_needs_note/);
    await expect(asUser(db, A, () => report("other", "fvg-001", "   "))).rejects.toThrow(/other_needs_note/);
    await asUser(db, A, () => report("other", "mss-003", "Candle 12 looks off"));
  });
});

describe("admin report functions", () => {
  it("refuse anyone without the admin role", async () => {
    await asUser(db, B, async () => {
      for (const fn of ["admin_exercise_reports()", "admin_recent_reports()", "admin_review_flags()", "admin_resolve_reports('fvg-001')"]) {
        await expect(q(`select * from ${fn}`)).rejects.toThrow(/admin only/);
      }
    });
  });

  it("count reports per exercise, by reason and reporter", async () => {
    const rows = await asUser(db, A, () => q(`select exercise_id, reports::int, open_reports::int, reporters::int, answer_wrong::int, chart_unclear::int, other::int from admin_exercise_reports()`));
    expect(rows).toEqual([
      { exercise_id: "fvg-001", reports: 2, open_reports: 2, reporters: 2, answer_wrong: 1, chart_unclear: 1, other: 0 },
      { exercise_id: "mss-003", reports: 1, open_reports: 1, reporters: 1, answer_wrong: 0, chart_unclear: 0, other: 1 },
    ]);
    const recent = await asUser(db, A, () => q(`select exercise_id, reason, note from admin_recent_reports(5)`));
    expect(recent[0]).toEqual({ exercise_id: "mss-003", reason: "other", note: "Candle 12 looks off" });
  });

  it("flag multiple open reports and anomalous failure rates, nothing else", async () => {
    const rows = await asUser(db, A, () =>
      q(`select exercise_id, attempts::int, success_rate, peer_success_rate, open_reports::int, flagged_reports, flagged_failure_rate from admin_review_flags()`),
    );
    expect(rows).toEqual([
      { exercise_id: "fvg-001", attempts: 10, success_rate: "0.900", peer_success_rate: "0.500", open_reports: 2, flagged_reports: true, flagged_failure_rate: false },
      { exercise_id: "fvg-005", attempts: 12, success_rate: "0.167", peer_success_rate: "0.900", open_reports: 0, flagged_reports: false, flagged_failure_rate: true },
    ]);
  });

  it("resolving an exercise's reports clears its report flag", async () => {
    expect(await asUser(db, A, () => q(`select admin_resolve_reports('fvg-001') as n`))).toEqual([{ n: 2 }]);
    const flags = await asUser(db, A, () => q(`select exercise_id from admin_review_flags()`));
    expect(flags).toEqual([{ exercise_id: "fvg-005" }]);
    expect((await asUser(db, B, () => q(`select status from question_reports`)))[0].status).toBe("resolved");
  });
});

describe("report reasons and app version (20260928120000)", () => {
  it("accepts an unclear-explanation report with the app version, and counts it for admins", async () => {
    await asUser(db, B, () =>
      q(`insert into question_reports (exercise_id, reason, stage, app_version) values ('fvg-002', 'explanation_unclear', 'feedback', '0.1.0+abc1234')`),
    );
    const rows = await asUser(db, A, () => q(`select explanation_unclear::int from admin_exercise_reports() where exercise_id = 'fvg-002'`));
    expect(rows).toEqual([{ explanation_unclear: 1 }]);
  });

  it("still refuses an unknown reason", async () => {
    await expect(asUser(db, B, () => q(`insert into question_reports (exercise_id, reason, stage) values ('fvg-002', 'nonsense', 'feedback')`))).rejects.toThrow(
      /check constraint/,
    );
  });
});
