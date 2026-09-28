// "Report a problem" (src/app/report/actions.ts): validates the report and
// writes it with the user's own session; the table's RLS and checks are in
// tests/sql/reports.test.ts.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { REPORT_REASONS } from "@/lib/report-reasons";

let signedIn = true;
let insertError: { code: string } | null = null;
/** Simulates 20260928120000 not being applied yet: rows with the new
 * column or reason are refused the way PostgREST / Postgres refuse them. */
let oldSchema = false;
const inserted: Record<string, unknown>[] = [];
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: signedIn ? { id: "u" } : null } }) },
    from: (table: string) => ({
      insert: async (row: Record<string, unknown>) => {
        if (oldSchema && "app_version" in row) return { error: { code: "PGRST204" } };
        if (!insertError) inserted.push({ table, ...row });
        return { error: insertError };
      },
    }),
  }),
}));
const { reportQuestion } = await import("@/app/report/actions");

const base = { exerciseId: "fvg-001", reason: "answer_wrong" as const, note: "", stage: "feedback" as const, sessionId: "s1" };

describe("reportQuestion", () => {
  beforeEach(() => {
    signedIn = true;
    insertError = null;
    oldSchema = false;
    inserted.length = 0;
  });

  it("files a report against the exercise on screen", async () => {
    expect(await reportQuestion({ ...base, note: "  the gap is higher  " })).toEqual({ ok: true });
    expect(inserted).toEqual([
      {
        table: "question_reports",
        exercise_id: "fvg-001",
        reason: "answer_wrong",
        note: "the gap is higher",
        stage: "feedback",
        session_id: "s1",
        app_version: expect.stringMatching(/^\d+\.\d+\.\d+/),
      },
    ]);
  });

  it("offers the six structured reasons the database accepts", () => {
    expect(REPORT_REASONS.map((r) => r.value)).toEqual(["answer_wrong", "chart_unclear", "explanation_unclear", "ambiguous", "technical", "other"]);
  });

  it("falls back to the old columns and reasons until 20260928120000 is applied", async () => {
    oldSchema = true;
    expect(await reportQuestion({ ...base, reason: "explanation_unclear", note: "step 2 contradicts the chart" })).toEqual({ ok: true });
    expect(inserted).toEqual([
      {
        table: "question_reports",
        exercise_id: "fvg-001",
        reason: "other",
        note: "[Explanation unclear] step 2 contradicts the chart",
        stage: "feedback",
        session_id: "s1",
      },
    ]);
  });

  it("refuses signed-out callers, unknown exercises, bad reasons, and 'other' without a note", async () => {
    signedIn = false;
    expect(await reportQuestion(base)).toMatchObject({ ok: false });
    signedIn = true;
    expect(await reportQuestion({ ...base, exerciseId: "nope" })).toMatchObject({ ok: false });
    // @ts-expect-error — a forged reason, as a direct POST could send
    expect(await reportQuestion({ ...base, reason: "spam" })).toMatchObject({ ok: false });
    expect(await reportQuestion({ ...base, reason: "other", note: "   " })).toMatchObject({ ok: false, error: /note/ });
    expect(inserted).toEqual([]);
  });

  it("says so when the table isn't there yet", async () => {
    insertError = { code: "PGRST205" };
    expect(await reportQuestion(base)).toEqual({ ok: false, error: "Reporting isn't available yet. Please try again later." });
  });
});
