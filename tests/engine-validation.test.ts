import { describe, expect, it } from "vitest";
import { MODES } from "@/lib/engine/modes";
import { cleanAttemptResponse } from "@/lib/engine/response-validation";
import { revealChunk, toPublicScenario, MAX_REVEAL } from "@/lib/engine/public";
import type { Scenario } from "@/lib/engine/types";
import sim001 from "@/data/sim-scenarios/sim-001.json";

const s = sim001 as unknown as Scenario;
const replayBody = (over: Record<string, unknown> = {}) => ({
  scenarioId: "sim-001",
  modeId: "simulator",
  confidence: 4,
  responseTimeMs: 5000,
  stages: { replay: { kind: "replay", annotations: [], bias: "bullish", decision: "wait", order: null, waits: 0, decidedAtRevealed: 900, ...over } },
});

describe("attempt response validation", () => {
  it("accepts a well-formed replay and a trade with an order", () => {
    expect(cleanAttemptResponse(replayBody(), MODES.simulator)).not.toBeNull();
    const order = { direction: "long", entry: null, stop: 100, target: 120, placedAt: 5 };
    expect(cleanAttemptResponse(replayBody({ decision: "long", order }), MODES.simulator)).not.toBeNull();
  });

  it("refuses an order that doesn't go with the decision, and the reverse", () => {
    const order = { direction: "long", entry: null, stop: 100, target: 120, placedAt: 5 };
    expect(cleanAttemptResponse(replayBody({ decision: "wait", order }), MODES.simulator)).toBeNull();
    expect(cleanAttemptResponse(replayBody({ decision: "long", order: null }), MODES.simulator)).toBeNull();
    expect(cleanAttemptResponse(replayBody({ decision: "short", order }), MODES.simulator)).toBeNull();
  });

  it("refuses stages the mode doesn't have, other modes' ids, junk numbers and oversized lists", () => {
    expect(cleanAttemptResponse({ ...replayBody(), stages: { other: { kind: "choice", value: "x" } } }, MODES.simulator)).toBeNull();
    expect(cleanAttemptResponse({ ...replayBody(), modeId: "blind_chart" }, MODES.simulator)).toBeNull();
    expect(cleanAttemptResponse(replayBody({ waits: "many" }), MODES.simulator)).toBeNull();
    const many = Array.from({ length: 200 }, (_, i) => ({ id: `a${i}`, kind: "liquidity", price: 100 }));
    expect(cleanAttemptResponse(replayBody({ annotations: many }), MODES.simulator)).toBeNull();
    expect(cleanAttemptResponse(replayBody({ annotations: [{ id: "x", kind: "rocket", price: 1 }] }), MODES.simulator)).toBeNull();
    expect(cleanAttemptResponse(replayBody({ annotations: [{ id: "x", kind: "liquidity", price: NaN }] }), MODES.simulator)).toBeNull();
  });

  it("clamps confidence and time to what the table allows", () => {
    const clean = cleanAttemptResponse({ ...replayBody(), confidence: 9, responseTimeMs: 9e12 }, MODES.simulator)!;
    expect(clean.confidence).toBeNull();
    expect(clean.responseTimeMs).toBe(24 * 60 * 60 * 1000);
  });
});

describe("what the browser may see", () => {
  it("never carries the reference, and only the candles up to the cursor", () => {
    const pub = toPublicScenario(s);
    const text = JSON.stringify(pub);
    expect(pub.stream).toHaveLength(s.cursorStart);
    for (const secret of ["reference", "trapMistakes", "whyNot", "decisionNote", "invalidation", "confirmedAtRevealed", "Previous day high"]) {
      expect(text, secret).not.toContain(secret);
    }
  });

  it("names candidates by what and where, never by what they mean", () => {
    const pub = toPublicScenario(s);
    const labels = pub.candidates.map((c) => c.label).join(" | ");
    for (const r of s.reference.annotations.filter((a) => a.candidate)) expect(labels).not.toContain(r.label);
    expect(labels).not.toMatch(/trap|matter|noise|small|looks valid|alternative|supports/i);
    expect(pub.candidates.length).toBeGreaterThanOrEqual(3);
  });

  it("exposes the confluence labels without their relevance", () => {
    const pub = toPublicScenario(s);
    expect(pub.confluenceOptions.length).toBeGreaterThanOrEqual(4);
    expect(JSON.stringify(pub.confluenceOptions)).not.toMatch(/strongest|misleading|irrelevant/);
  });

  it("reveals in bounded chunks and says when the stream is done", () => {
    const a = revealChunk(s, s.cursorStart, 50);
    expect(a.rows).toHaveLength(50);
    expect(a.done).toBe(false);
    expect(revealChunk(s, s.cursorStart, 10_000).rows.length).toBeLessThanOrEqual(MAX_REVEAL);
    expect(revealChunk(s, s.data.stream.length - 3, 50).done).toBe(true);
  });
});
