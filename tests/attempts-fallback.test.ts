// Production runs ahead of the migrations (B4): writes and reads degrade by
// one migration at a time rather than failing, and applying one migration
// doesn't need another.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { attempt } from "./fixtures";

type Call = { table: string; rows: Record<string, unknown>[] };
const calls: Call[] = [];
/** Columns the "database" doesn't have yet. */
let missing: string[] = [];
let failWith: { code: string; message: string } | null = null;
let selectMissing: string[] = [];
let selects: string[] = [];

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: (table: string) => ({
      insert: async (payload: Record<string, unknown> | Record<string, unknown>[]) => {
        const rows = Array.isArray(payload) ? payload : [payload];
        calls.push({ table, rows });
        if (failWith) return { error: failWith };
        const bad = Object.keys(rows[0]).find((k) => missing.includes(k));
        return { error: bad ? { code: "PGRST204", message: `Could not find the '${bad}' column` } : null };
      },
      select: (columns: string) => {
        selects.push(columns);
        const bad = columns.split(",").find((c) => selectMissing.includes(c));
        const result = { data: bad ? null : [], error: bad ? { code: "42703", message: `column ${bad} does not exist` } : null };
        const chain: Record<string, unknown> = {};
        chain.eq = () => chain;
        chain.order = () => Promise.resolve(result);
        return chain;
      },
    }),
  }),
}));

const { fetchAttempts, insertAttempt, savePendingResults } = await import("@/lib/attempts");

const row = (() => {
  const { id: _id, user_id: _u, created_at: _c, ...rest } = attempt("FVG", true, { confidence: 2 });
  return rest;
})();

beforeEach(() => {
  calls.length = 0;
  missing = [];
  failWith = null;
  selectMissing = [];
  selects = [];
});

describe("writing attempts before the migrations are applied", () => {
  it("writes everything when the database has everything", async () => {
    await insertAttempt("u", row);
    expect(calls).toHaveLength(1);
    expect(calls[0].rows[0]).toMatchObject({ confidence: 2, verdict: "correct" });
  });

  it("drops only the confidence rating when only that migration is missing, keeping the verdicts", async () => {
    missing = ["confidence"];
    await insertAttempt("u", row);
    const last = calls.at(-1)!.rows[0];
    expect(last).not.toHaveProperty("confidence");
    expect(last).toMatchObject({ verdict: "correct", is_correct: true });
  });

  it("drops the verdicts too when those are missing as well, and still records the attempt", async () => {
    missing = ["confidence", "verdict", "guided_bias_verdict"];
    await insertAttempt("u", row);
    const last = calls.at(-1)!.rows[0];
    expect(last).not.toHaveProperty("confidence");
    expect(last).not.toHaveProperty("verdict");
    expect(last).toMatchObject({ is_correct: true, user_id: "u", exercise_id: row.exercise_id });
    expect(calls).toHaveLength(3);
  });

  it("doesn't retry an error that isn't a missing column", async () => {
    failWith = { code: "42501", message: "new row violates row-level security policy" };
    await expect(insertAttempt("u", row)).rejects.toMatchObject({ code: "42501" });
    expect(calls).toHaveLength(1);
  });

  it("saves results kept from public links the same way, numbering repeats", async () => {
    missing = ["confidence"];
    const n = await savePendingResults("u", [row, row]);
    expect(n).toBe(2);
    const last = calls.at(-1)!.rows;
    expect(last).toHaveLength(2);
    expect(last.every((r) => !("confidence" in r))).toBe(true);
  });
});

describe("reading attempts before the migrations are applied", () => {
  it("retries without the confidence column, then without the verdict", async () => {
    selectMissing = ["confidence", "verdict"];
    await fetchAttempts("u", "id,verdict,confidence,is_correct");
    expect(selects).toEqual(["id,verdict,confidence,is_correct", "id,verdict,is_correct", "id,is_correct"]);
  });

  it("keeps the verdict when only the confidence column is missing", async () => {
    selectMissing = ["confidence"];
    await fetchAttempts("u", "id,verdict,confidence");
    expect(selects.at(-1)).toBe("id,verdict");
  });
});
