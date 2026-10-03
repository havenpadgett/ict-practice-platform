// Public challenge links (src/lib/challenge.ts, src/app/c/): a visitor with
// no account gets a chart and a prompt and nothing that grades it. The key
// comes back only with a verdict, only for shareable exercises, and nothing
// is written to the database from the public path.

import { afterEach, describe, expect, it } from "vitest";
import { gradeChallengeGuided, gradeChallengeRecognition } from "@/app/c/actions";
import { exercises, isPracticeReady } from "@/data/exercises";
import { canShare, challengePath, practiceMoreHref, signUpHref } from "@/lib/challenge";
import { resolveChallenge, shareableExercise } from "@/lib/challenge-source";
import { toPublicExercise } from "@/lib/public-exercise";
import { safeNextPath } from "@/lib/safe-redirect";

const shareable = exercises.filter((e) => shareableExercise(e.exercise_id) !== null);
const zone = shareable.find((e) => e.answer_type === "zone" && !e.provenance && e.has_answer)!;
const level = shareable.find((e) => e.answer_type === "level" && !e.provenance && e.has_answer)!;
const choice = shareable.find((e) => e.answer_type === "choice")!;
const guided = shareable.find((e) => e.answer_type === "guided" && !e.provenance)!;
const free = exercises.find((e) => e.answer_type === "free" && isPracticeReady(e))!;
const unready = exercises.find((e) => !isPracticeReady(e))!;
const ctx = { source: "challenge", responseTimeMs: 4200 };

describe("what can be shared", () => {
  it("covers recognition and Guided Entry, never Free Trade or an unapproved scenario", () => {
    expect(shareable.length).toBeGreaterThan(50);
    expect(shareable.some((e) => e.answer_type === "free")).toBe(false);
    expect(shareableExercise(free.exercise_id)).toBeNull();
    expect(shareableExercise(unready.exercise_id)).toBeNull();
    expect(shareableExercise("nope")).toBeNull();
    expect(shareableExercise(42)).toBeNull();
    expect(shareableExercise("x".repeat(500))).toBeNull();
  });

  it("every shareable exercise projects without a key", () => {
    const FORBIDDEN = ["answer", "explanation", "distractor_note", "provenance", "correct_choice", "step_explanations", "overall_explanation", "setup_span", "has_answer", "hidden_candles"];
    for (const e of shareable) {
      const json = JSON.stringify(toPublicExercise(e));
      for (const f of FORBIDDEN) expect(json, `${e.exercise_id} carries "${f}"`).not.toContain(`"${f}"`);
      expect(json).not.toContain(e.explanation.slice(0, 50));
    }
  });

  it("real-data charts can be switched off without a code change", () => {
    const real = shareable.find((e) => e.provenance !== undefined)!;
    expect(real).toBeDefined();
    const before = process.env.NEXT_PUBLIC_SHARE_REAL_SCENARIOS;
    process.env.NEXT_PUBLIC_SHARE_REAL_SCENARIOS = "false";
    try {
      expect(shareableExercise(real.exercise_id)).toBeNull();
      expect(shareableExercise(zone.exercise_id)).not.toBeNull();
      expect(canShare({ answer_type: "zone", practice_ready: true, real: true })).toBe(false);
    } finally {
      if (before === undefined) delete process.env.NEXT_PUBLIC_SHARE_REAL_SCENARIOS;
      else process.env.NEXT_PUBLIC_SHARE_REAL_SCENARIOS = before;
    }
  });

  it("builds links that survive sign-up", () => {
    expect(challengePath("fvg-001")).toBe("/c/fvg-001");
    // The post-sign-up destination keeps its query, and is a same-site path.
    const href = signUpHref(practiceMoreHref("FVG"));
    const next = new URL(href, "https://x.test").searchParams.get("next");
    expect(next).toBe("/practice?concept=FVG");
    expect(safeNextPath(next)).toBe("/practice?concept=FVG");
  });
});

describe("grading a public challenge", () => {
  afterEach(() => undefined);

  it("reveals the key only alongside a verdict, and builds the visitor's attempt row", async () => {
    if (zone.answer_type !== "zone" || !zone.answer) throw new Error("fixture");
    const a = zone.answer;
    const res = await gradeChallengeRecognition(
      zone.exercise_id,
      { type: "region", region: { priceLow: a.price_low, priceHigh: a.price_high, candleIndexLow: a.candle_start, candleIndexHigh: a.candle_end } },
      { ...ctx, confidence: 2 },
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.grade.isCorrect).toBe(true);
    expect(res.reveal.zone).toEqual(a);
    expect(res.row).toMatchObject({
      exercise_id: zone.exercise_id,
      session_id: `challenge:${zone.exercise_id}`,
      response_time_ms: 4200,
      is_correct: true,
      confidence: 2,
    });
  });

  it("grades a level and a choice, and Guided Entry through its own function", async () => {
    if (level.answer_type !== "level" || !level.answer) throw new Error("fixture");
    const lv = await gradeChallengeRecognition(level.exercise_id, { type: "level", price: level.answer.price }, ctx);
    expect(lv).toMatchObject({ ok: true, grade: { isCorrect: true } });
    if (choice.answer_type !== "choice") throw new Error("fixture");
    const ch = await gradeChallengeRecognition(choice.exercise_id, { type: "choice", choice: choice.answer.correct_choice }, ctx);
    expect(ch).toMatchObject({ ok: true, grade: { isCorrect: true } });
    const g = await gradeChallengeGuided(guided.exercise_id, { bias: "unclear", entry: null, stop: null, target: null, declaredTrade: false }, ctx);
    expect(g).toMatchObject({ ok: true, row: { answer_type: "guided", session_id: `challenge:${guided.exercise_id}` } });
  });

  it("refuses anything outside the shareable set, wrong modes and malformed input", async () => {
    expect(await gradeChallengeRecognition(free.exercise_id, { type: "none" }, ctx)).toMatchObject({ ok: false });
    expect(await gradeChallengeRecognition(unready.exercise_id, { type: "none" }, ctx)).toMatchObject({ ok: false });
    expect(await gradeChallengeRecognition(zone.exercise_id, { type: "none" }, { ...ctx, source: "somewhere-else" })).toMatchObject({ ok: false });
    // @ts-expect-error — direct POSTs can send anything
    expect(await gradeChallengeRecognition(zone.exercise_id, { type: "region", region: { priceLow: "x" } }, ctx)).toMatchObject({ ok: false });
    expect(await gradeChallengeRecognition(guided.exercise_id, { type: "none" }, ctx)).toMatchObject({ ok: false });
    expect(await gradeChallengeGuided(zone.exercise_id, { bias: "unclear", entry: null, stop: null, target: null, declaredTrade: false }, ctx)).toMatchObject({ ok: false });
    // @ts-expect-error — forged shape
    expect(await gradeChallengeGuided(guided.exercise_id, { bias: "sideways" }, ctx)).toMatchObject({ ok: false });
  });

  it("clamps what the browser reports about the attempt", async () => {
    const res = await gradeChallengeRecognition(zone.exercise_id, { type: "none" }, { source: "challenge", responseTimeMs: 9e12, confidence: 99 });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.row).toMatchObject({ response_time_ms: 86_400_000, confidence: null });
    const neg = await gradeChallengeRecognition(zone.exercise_id, { type: "none" }, { source: "challenge", responseTimeMs: -5 });
    if (neg.ok) expect(neg.row.response_time_ms).toBe(0);
  });

  it("resolves a source to the one exercise it may grade", () => {
    expect(resolveChallenge(zone.exercise_id, "challenge")?.sessionId).toBe(`challenge:${zone.exercise_id}`);
    expect(resolveChallenge(zone.exercise_id, "other")).toBeNull();
    expect(resolveChallenge(free.exercise_id, "challenge")).toBeNull();
  });
});
