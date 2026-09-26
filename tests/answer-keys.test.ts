// docs/ANSWER-KEYS.md: the browser never receives an answer key before the
// user answers. Three guards: the public projection strips every key field,
// the grading Server Functions only reveal a key alongside a verdict (and
// only for signed-in users and practice-ready exercises), and no browser
// module can import the full exercise data.

import fs from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { exercises, isPracticeReady } from "@/data/exercises";
import { gradeAttempt } from "@/lib/grading";
import { toPublicExercise } from "@/lib/public-exercise";

let signedIn = true;
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: signedIn ? { id: "u" } : null } }) },
  }),
}));

const { gradeFreeTradeScenario, gradeGuided, gradeRecognition, loadSessionExercises } = await import("@/app/practice/actions");

const KEY_FIELDS = [
  "answer",
  "explanation",
  "distractor_note",
  "provenance",
  "correct_choice",
  "step_explanations",
  "overall_explanation",
  "is_valid_setup",
  "entry_zone",
  "stop_zone",
  "intended_bias",
  "has_answer",
];

function keysDeep(x: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(x)) x.forEach((v) => keysDeep(v, out));
  else if (x && typeof x === "object") {
    for (const [k, v] of Object.entries(x)) {
      out.add(k);
      keysDeep(v, out);
    }
  }
  return out;
}

describe("public exercise projection", () => {
  it.each(exercises.map((e) => [e.exercise_id, e] as const))("%s carries no answer key", (_id, e) => {
    const pub = toPublicExercise(e);
    const keys = keysDeep(pub);
    for (const f of KEY_FIELDS) expect(keys.has(f), f).toBe(false);
    const json = JSON.stringify(pub);
    expect(json).not.toContain(e.explanation.slice(0, 60));
    // Zone and level keys: the exact answer prices never appear outside candles.
    if ((e.answer_type === "zone" || e.answer_type === "level") && e.answer) {
      const { candles, ...rest } = pub;
      expect(candles).toBe(e.candles);
      const priceKeys = e.answer_type === "zone" ? ["price_low", "price_high", "key_candle_index"] : ["price", "tolerance"];
      for (const k of priceKeys) expect(keysDeep(rest).has(k), k).toBe(false);
    }
  });
});

describe("grading Server Functions", () => {
  const ctx = { sessionId: "s1", responseTimeMs: 1234 };
  const zone = exercises.find((e) => e.answer_type === "zone" && e.has_answer && isPracticeReady(e))!;
  const unreviewed = exercises.find((e) => !isPracticeReady(e))!;

  beforeEach(() => {
    signedIn = true;
  });

  it("refuse signed-out callers", async () => {
    signedIn = false;
    expect(await loadSessionExercises([zone.exercise_id])).toMatchObject({ ok: false });
    expect(await gradeRecognition(zone.exercise_id, { type: "none" }, ctx)).toMatchObject({ ok: false });
  });

  it("serve practice-ready exercises without keys, and never an unreviewed one", async () => {
    const res = await loadSessionExercises([zone.exercise_id, unreviewed.exercise_id, "no-such-id"]);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.exercises[zone.exercise_id]).toEqual(toPublicExercise(zone));
    expect(res.exercises[unreviewed.exercise_id]).toBeNull();
    expect(res.exercises["no-such-id"]).toBeNull();
  });

  it("grade exactly as the grading library does, and return the key with the verdict", async () => {
    if (zone.answer_type !== "zone" || !zone.answer) throw new Error("fixture");
    const a = zone.answer;
    const answer = {
      type: "region" as const,
      region: { priceLow: a.price_low, priceHigh: a.price_high, candleIndexLow: a.candle_start, candleIndexHigh: a.candle_end },
    };
    const res = await gradeRecognition(zone.exercise_id, answer, ctx);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.grade).toEqual(gradeAttempt(zone, answer));
    expect(res.reveal.zone).toEqual(a);
    expect(res.row).toMatchObject({ exercise_id: zone.exercise_id, session_id: "s1", response_time_ms: 1234, is_correct: true });
  });

  it("won't grade an unreviewed scenario or a malformed answer", async () => {
    expect(await gradeRecognition(unreviewed.exercise_id, { type: "none" }, ctx)).toMatchObject({ ok: false });
    // @ts-expect-error — deliberately malformed input, as a direct POST could send
    expect(await gradeRecognition(zone.exercise_id, { type: "region", region: { priceLow: "x" } }, ctx)).toMatchObject({ ok: false });
    // Wrong mode for this exercise.
    expect(await gradeGuided(zone.exercise_id, { bias: "unclear", entry: null, stop: null, target: null, declaredTrade: false }, ctx)).toMatchObject({ ok: false });
  });

  it("grade Guided Entry and Free Trade server-side", async () => {
    const guided = exercises.find((e) => e.answer_type === "guided" && isPracticeReady(e))!;
    const g = await gradeGuided(guided.exercise_id, { bias: "unclear", entry: null, stop: null, target: null, declaredTrade: false }, ctx);
    expect(g).toMatchObject({ ok: true, row: { answer_type: "guided", guided_bias_choice: "unclear" } });
    const free = exercises.find((e) => e.answer_type === "free" && isPracticeReady(e))!;
    const f = await gradeFreeTradeScenario(free.exercise_id, null, null, ctx);
    expect(f).toMatchObject({ ok: true, row: { answer_type: "free", free_direction: "none", free_outcome: "no_trade" } });
  });
});

describe("no browser module can import the answer keys", () => {
  const SRC = path.resolve(__dirname, "../src");
  const FORBIDDEN = [/^src\/data\/exercises\.ts$/, /^src\/data\/real-scenarios\//, /^src\/data\/.*-exercises\.ts$/, /^src\/data\/free-trade-scenarios\.ts$/];

  function resolve(spec: string, from: string): string | null {
    const base = spec.startsWith("@/") ? path.join(SRC, spec.slice(2)) : spec.startsWith(".") ? path.resolve(path.dirname(from), spec) : null;
    if (!base) return null;
    for (const cand of [base, `${base}.ts`, `${base}.tsx`, path.join(base, "index.ts")]) {
      if (fs.existsSync(cand) && fs.statSync(cand).isFile()) return cand;
    }
    return null;
  }

  /** Value (non-type) imports of a module. */
  function valueImports(file: string): string[] {
    const src = fs.readFileSync(file, "utf8");
    const out: string[] = [];
    for (const m of src.matchAll(/^\s*(import|export)\s+(?!type\b)([^;]*?)\s+from\s+"([^"]+)"/gm)) {
      const clause = m[2];
      // `import { type A, type B }` is type-only too.
      if (/^\{[^}]*\}$/.test(clause.trim()) && clause.replace(/[{}\s]/g, "").split(",").filter(Boolean).every((p) => p.startsWith("type"))) continue;
      const r = resolve(m[3], file);
      if (r) out.push(r);
    }
    return out;
  }

  const clientEntries = (function walk(dir: string): string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
      const p = path.join(dir, d.name);
      if (d.isDirectory()) return walk(p);
      return /\.tsx?$/.test(d.name) && /^\s*["']use client["']/.test(fs.readFileSync(p, "utf8")) ? [p] : [];
    });
  })(SRC);

  // /review is the one internal page that needs keys (a reviewer checks them).
  const entries = clientEntries.filter((f) => !f.includes(`${path.sep}app${path.sep}review${path.sep}`));

  it.each(entries.map((f) => [path.relative(path.resolve(SRC, ".."), f), f]))("%s", (_rel, entry) => {
    const seen = new Set<string>();
    const stack = [entry];
    while (stack.length) {
      const f = stack.pop()!;
      if (seen.has(f)) continue;
      seen.add(f);
      const rel = path.relative(path.resolve(SRC, ".."), f).split(path.sep).join("/");
      expect(FORBIDDEN.some((re) => re.test(rel)), `${rel} reachable from a client module`).toBe(false);
      // A "use server" module crosses to the server; its imports stay there.
      if (f !== entry && /^\s*["']use server["']/.test(fs.readFileSync(f, "utf8"))) continue;
      stack.push(...valueImports(f));
    }
  });
});
