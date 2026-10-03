// Share cards (src/lib/card/, src/app/api/card/): the request carries no
// free text, the card grades the mark itself, and it never shows money.

import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/card/route";
import { exercises } from "@/data/exercises";
import { buildCard, parseCardRequest, type CardRequest } from "@/lib/card/model";
import { markFromRow, pickFeatured, sessionCardRequest } from "@/lib/session-share";
import { shareableExercise } from "@/lib/challenge-source";
import { buildAnswerAttempt } from "@/lib/attempt-rows";
import { gradeAttempt } from "@/lib/grading";

const zone = exercises.find((e) => e.answer_type === "zone" && !e.provenance && e.has_answer)!;
const free = exercises.find((e) => e.answer_type === "free")!;
if (zone.answer_type !== "zone" || !zone.answer) throw new Error("fixture");
const key = zone.answer;
const hit = { priceLow: key.price_low, priceHigh: key.price_high, candleIndexLow: key.candle_start, candleIndexHigh: key.candle_end };

const result = (extra: Record<string, unknown> = {}) => ({
  kind: "result",
  exerciseId: zone.exercise_id,
  answer: { mode: "recognition", answer: { type: "region", region: hit } },
  ...extra,
});

describe("card requests", () => {
  it("accept only ids, numbers and the learner's own marks", () => {
    expect(parseCardRequest(result())).toMatchObject({ kind: "result", exerciseId: zone.exercise_id });
    expect(parseCardRequest(result({ daily: { date: "2026-10-03", streak: 4 } }))).toMatchObject({ daily: { date: "2026-10-03", streak: 4 } });
  });

  it("refuse anything malformed, oversized or carrying free text", () => {
    for (const bad of [
      null, "x", {}, { kind: "nope" },
      result({ exerciseId: 5 }),
      result({ answer: { mode: "recognition", answer: { type: "region", region: { priceLow: "x" } } } }),
      result({ answer: { mode: "guided", answer: { bias: "sideways" } } }),
      result({ daily: { date: "tomorrow", streak: 1 } }),
      result({ sessionId: "s".repeat(500) }),
      { kind: "session", session: "<script>", correct: 1, answered: 2, concepts: [] },
      { kind: "session", session: "FVG", correct: 3, answered: 2, concepts: [] },
      { kind: "session", session: "FVG", correct: 1, answered: 2, concepts: [{ concept: "Made Up", correct: 1, total: 1 }] },
      { kind: "session", session: "FVG", correct: 1, answered: 2, concepts: [{ concept: "FVG", correct: 2, total: 1 }] },
    ]) {
      expect(parseCardRequest(bad), JSON.stringify(bad)).toBeNull();
    }
  });
});

describe("building a card", () => {
  it("grades the mark itself: the verdict comes from the grader, not the request", () => {
    const right = buildCard(parseCardRequest(result())!)!;
    expect(right.headline).toBe("Correct");
    expect(right.tone).toBe("correct");
    const wrong = buildCard(parseCardRequest(result({ answer: { mode: "recognition", answer: { type: "none" } } }))!)!;
    expect(wrong.headline).toBe("Incorrect");
    expect(wrong.tone).toBe("incorrect");
  });

  it("draws the learner's mark against the correct one, on a chart", () => {
    const card = buildCard(parseCardRequest(result())!)!;
    expect(card.chart?.marks.userZone).toBeTruthy();
    expect(card.chart?.marks.correctZone).toEqual(key);
    expect(card.chart?.candles.length).toBe(zone.candles.length);
  });

  it("shows the date and streak only for a daily result", () => {
    expect(buildCard(parseCardRequest(result({ daily: { date: "2026-10-03", streak: 4 } }))!)!.badge).toBe("Daily challenge · Oct 3 · 4-day streak");
    expect(buildCard(parseCardRequest(result({ daily: { date: "2026-10-03", streak: 1 } }))!)!.badge).toBe("Daily challenge · Oct 3");
    expect(buildCard(parseCardRequest(result())!)!.badge).toBe("Chart challenge");
  });

  it("won't draw an exercise that can't be shared", () => {
    expect(shareableExercise(free.exercise_id)).toBeNull();
    expect(buildCard({ kind: "result", exerciseId: free.exercise_id, answer: { mode: "recognition", answer: { type: "none" } } })).toBeNull();
    expect(buildCard({ kind: "result", exerciseId: "nope", answer: { mode: "recognition", answer: { type: "none" } } })).toBeNull();
  });

  it("a session card is the session's own count and concepts, nothing else", () => {
    const req: CardRequest = {
      kind: "session", session: "Adaptive", correct: 7, answered: 10,
      concepts: [{ concept: "FVG", correct: 3, total: 3 }, { concept: "MSS", correct: 2, total: 3 }],
    };
    const card = buildCard(req)!;
    expect(card).toMatchObject({ headline: "7/10", sub: "70% correct · 3 missed", chips: ["FVG 3/3", "MSS 2/3"], chart: null });
    // No money, P&L or R figure can be on a card: every string comes from here.
    const text = JSON.stringify(card);
    expect(text).not.toMatch(/\$|P&L|profit|\bR\b|win rate|users|people/i);
  });

  it("a session's chart is the one the learner saw, with their mark shifted into it", () => {
    const req = parseCardRequest({
      kind: "session", session: "FVG", correct: 1, answered: 1, concepts: [{ concept: "FVG", correct: 1, total: 1 }],
      featured: { exerciseId: zone.exercise_id, sessionId: "session_abc", answer: { mode: "recognition", answer: { type: "region", region: hit } } },
    })!;
    const card = buildCard(req)!;
    expect(card.chart).not.toBeNull();
    const shown = card.chart!;
    // The displayed window can be shorter than the stored one, and the marks sit inside it.
    expect(shown.candles.length).toBeLessThanOrEqual(zone.candles.length);
    expect(shown.marks.userZone!.candleIndexHigh).toBeLessThan(shown.candles.length);
    expect(shown.marks.userZone!.candleIndexLow).toBeGreaterThanOrEqual(0);
  });
});

describe("marks from a recorded attempt", () => {
  it("round-trips a drawn box into a card answer", () => {
    const grade = gradeAttempt(zone, { type: "region", region: hit });
    const row = buildAnswerAttempt(zone, { type: "region", region: hit }, grade, { sessionId: "s", responseTimeMs: 1, attemptNumber: 1 });
    expect(markFromRow(row)).toEqual({ mode: "recognition", answer: { type: "region", region: hit } });
  });

  it("features the latest correct drawn answer, and builds the request", () => {
    const outcomes = [
      { exercise_id: zone.exercise_id, correct: false, failure_reason: "coverage", mark: { mode: "recognition" as const, answer: { type: "region" as const, region: hit } } },
      { exercise_id: zone.exercise_id, correct: true, failure_reason: null, mark: { mode: "recognition" as const, answer: { type: "region" as const, region: hit } } },
      { exercise_id: zone.exercise_id, correct: false, failure_reason: null, mark: { mode: "recognition" as const, answer: { type: "none" as const } } },
    ];
    expect(pickFeatured({ outcomes })?.answer).toEqual(outcomes[1].mark);
    const req = sessionCardRequest({ session_id: "s9", concept: "FVG", exercise_order: [], missed_exercise_ids: [zone.exercise_id, zone.exercise_id], outcomes, correct_count: 1 })!;
    expect(parseCardRequest(JSON.parse(JSON.stringify(req)))).not.toBeNull();
    expect(req).toMatchObject({ kind: "session", correct: 1, answered: 3, concepts: [{ concept: "FVG", correct: 1, total: 3 }] });
  });
});

describe("POST /api/card", () => {
  const post = (body: unknown, raw?: string) =>
    POST(new Request("http://x.test/api/card", { method: "POST", body: raw ?? JSON.stringify(body) }));

  it("returns a PNG, uncached", async () => {
    const res = await post(result());
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(res.headers.get("cache-control")).toBe("no-store");
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect(Array.from(bytes.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47]);
  });

  it("answers 4xx for bad input without drawing anything", async () => {
    expect((await post(null, "not json")).status).toBe(400);
    expect((await post({ kind: "result" })).status).toBe(400);
    expect((await post(null, "x".repeat(10_000))).status).toBe(413);
    expect((await post({ kind: "result", exerciseId: "nope", answer: { mode: "recognition", answer: { type: "none" } } })).status).toBe(404);
    expect((await post({ kind: "result", exerciseId: free.exercise_id, answer: { mode: "recognition", answer: { type: "none" } } })).status).toBe(404);
  });
});
