import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildAnswerAttempt, buildFreeTradeAttempt, buildGuidedAttempt } from "@/lib/attempt-rows";
import { gradeFreeTrade } from "@/lib/free-trade-grading";
import { gradeAttempt } from "@/lib/grading";
import { gradeGuidedAttempt } from "@/lib/guided-grading";
import { loadSession } from "@/lib/storage";
import { freeTrade, guided, zone } from "./fixtures";

const ROOT = path.resolve(__dirname, "..");
const MIGRATIONS = fs
  .readdirSync(path.join(ROOT, "supabase/migrations"))
  .sort()
  .map((f) => fs.readFileSync(path.join(ROOT, "supabase/migrations", f), "utf8"))
  .join("\n");

/** PRD Section 9 fields and where each lives in the attempts table. Fields
 * the database fills itself (id, created_at) are checked against the
 * schema; the rest must be in the row the app writes. */
const SECTION_9: Record<string, { column: string; dbDefault?: boolean }> = {
  attempt_id: { column: "id", dbDefault: true },
  session_id: { column: "session_id" },
  exercise_id: { column: "exercise_id" },
  concept: { column: "concept" },
  user_answer_type: { column: "user_answer_type" },
  user_price_low: { column: "user_price_low" },
  user_price_high: { column: "user_price_high" },
  user_candle_start: { column: "user_candle_start" },
  user_candle_end: { column: "user_candle_end" },
  is_correct: { column: "is_correct" },
  coverage: { column: "coverage" },
  precision_ratio: { column: "precision_ratio" },
  failure_reason: { column: "failure_reason" },
  response_time_ms: { column: "response_time_ms" },
  attempt_number: { column: "attempt_number" },
  timestamp: { column: "created_at", dbDefault: true },
};

const meta = { responseTimeMs: 4200, attemptNumber: 3 };

function rows() {
  const z = zone();
  const zAnswer = { type: "region", region: { priceLow: 99, priceHigh: 121, candleIndexLow: 8, candleIndexHigh: 12 } } as const;
  const g = guided();
  const gAnswer = { bias: "bullish" as const, entry: 110, stop: 100, target: 140, declaredTrade: true };
  const f = freeTrade();
  const pos = { direction: "long" as const, entryIndex: 8, entry: 110, stop: 98, target: 140 };
  return {
    zone: buildAnswerAttempt(z, zAnswer, gradeAttempt(z, zAnswer), meta),
    guided: buildGuidedAttempt(g, gAnswer, gradeGuidedAttempt(g, gAnswer), meta),
    free: buildFreeTradeAttempt(f, pos, null, gradeFreeTrade(f, pos, null), meta),
  };
}

describe("attempts record every PRD Section 9 field", () => {
  for (const [field, { column, dbDefault }] of Object.entries(SECTION_9)) {
    it(`${field} (${column})`, () => {
      expect(MIGRATIONS).toMatch(new RegExp(`\\b${column}\\b\\s+(uuid|text|double precision|integer|boolean|timestamptz|smallint)`));
      if (!dbDefault) {
        for (const row of Object.values(rows())) expect(row).toHaveProperty(column);
      }
    });
  }

  it("a zone attempt carries the raw box, coverage, precision and timing", () => {
    const r = rows().zone;
    expect(r).toMatchObject({
      exercise_id: "t-zone",
      concept: "FVG",
      user_answer_type: "region",
      user_price_low: 99,
      user_price_high: 121,
      user_candle_start: 8,
      user_candle_end: 12,
      is_correct: true,
      coverage: 1,
      precision_ratio: 1.1,
      failure_reason: null,
      response_time_ms: 4200,
      attempt_number: 3,
    });
  });

  it("every row has exactly the same columns, whatever the mode", () => {
    const [a, b, c] = Object.values(rows()).map((r) => Object.keys(r).sort());
    expect(b).toEqual(a);
    expect(c).toEqual(a);
  });
});

describe("stored session data", () => {
  const store = new Map<string, string>();
  beforeEach(() => {
    store.clear();
    (globalThis as { window?: unknown }).window = {
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
        removeItem: (k: string) => void store.delete(k),
      },
    };
  });
  afterEach(() => {
    delete (globalThis as { window?: unknown }).window;
  });

  const base = {
    version: 1,
    session_id: "s",
    exercise_order: ["fvg-001"],
    current_index: 0,
    correct_count: 0,
    missed_exercise_ids: [],
    completed: false,
  };

  it.each([
    ["missing concept", { ...base }],
    ["unknown concept", { ...base, concept: "Astrology" }],
    ["not JSON", "{oops"],
  ])("discards a session with %s instead of crashing", (_label, value) => {
    store.set("ict-practice:session", typeof value === "string" ? value : JSON.stringify(value));
    expect(() => loadSession()).not.toThrow();
    expect(loadSession()).toBeNull();
  });

  it("keeps a valid session", () => {
    store.set("ict-practice:session", JSON.stringify({ ...base, concept: "FVG" }));
    expect(loadSession()?.concept).toBe("FVG");
  });
});

describe("row level security on attempts", () => {
  it("is enabled, and every policy is scoped to the owner", () => {
    expect(MIGRATIONS).toMatch(/alter table public\.attempts enable row level security/);
    const policies = MIGRATIONS.split(/create policy /)
      .slice(1)
      .map((p) => p.slice(0, p.indexOf(";")))
      .filter((p) => /on public\.attempts\b/.test(p));
    expect(policies.map((p) => p.match(/for (\w+)/)![1]).sort()).toEqual(["delete", "insert", "select", "update"]);
    for (const p of policies) {
      const clauses = [...p.matchAll(/(using|with check) \((.*?)\)\s*(?=with check|$)/gs)].map((m) => m[2].trim());
      expect(clauses.length).toBeGreaterThan(0);
      for (const c of clauses) expect(c).toBe("auth.uid() = user_id");
    }
  });

  // Live check against a real Supabase project. Needs two throwaway test
  // accounts; skipped unless their credentials are in the environment.
  const live = ["RLS_TEST_USER_A_EMAIL", "RLS_TEST_USER_A_PASSWORD", "RLS_TEST_USER_B_EMAIL", "RLS_TEST_USER_B_PASSWORD"].every(
    (k) => process.env[k],
  );
  it.skipIf(!live)("user B cannot read user A's attempts (live)", async () => {
    const { createClient } = await import("@supabase/supabase-js");
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)!;
    const a = createClient(url, key);
    const b = createClient(url, key);
    const { data: ua } = await a.auth.signInWithPassword({ email: process.env.RLS_TEST_USER_A_EMAIL!, password: process.env.RLS_TEST_USER_A_PASSWORD! });
    await b.auth.signInWithPassword({ email: process.env.RLS_TEST_USER_B_EMAIL!, password: process.env.RLS_TEST_USER_B_PASSWORD! });
    const { data } = await b.from("attempts").select("id").eq("user_id", ua.user!.id);
    expect(data ?? []).toHaveLength(0);
  });
});
