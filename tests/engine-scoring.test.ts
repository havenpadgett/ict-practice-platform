import { describe, expect, it } from "vitest";
import { compareMarks, creditForChoice, creditForRange, scoreMarks } from "@/lib/engine/accept";
import { fromRow, toRow } from "@/lib/engine/candles";
import { MODES } from "@/lib/engine/modes";
import { scoreAttempt } from "@/lib/engine/scoring";
import { etMinutes } from "@/lib/engine/time";
import type { Annotation, AttemptResponse, RefAnnotation, ReplayResponse, Scenario } from "@/lib/engine/types";
import sim001 from "@/data/sim-scenarios/sim-001.json";

const base = sim001 as unknown as Scenario;
const at = (h: number, m: number) => base.data.stream.map(fromRow).findIndex((c) => c.t === etMinutes(2030, 1, 22, h, m));

/** A user mark placed exactly on a reference mark. */
function markOn(r: RefAnnotation): Annotation {
  return { id: `u-${r.id}`, kind: r.kind, price: r.price, priceLow: r.priceLow, priceHigh: r.priceHigh, tStart: r.tStart, tEnd: r.tEnd, t: r.t, tf: "5m" };
}

const keyMarks = (s: Scenario) => s.reference.annotations.filter((r) => ["overnight-low", "pdh", "fvg-5m", "sweep-low"].includes(r.id)).map(markOn);

function replay(over: Partial<ReplayResponse>): AttemptResponse {
  return {
    scenarioId: base.id,
    modeId: "simulator",
    confidence: 4,
    responseTimeMs: 1000,
    stages: {
      replay: {
        kind: "replay",
        annotations: keyMarks(base),
        bias: "bullish",
        decision: "long",
        order: null,
        waits: 0,
        decidedAtRevealed: at(9, 50),
        ...over,
      },
    },
  };
}

const idealOrder = () => {
  const fvg = base.reference.annotations.find((r) => r.id === "fvg-5m")!;
  const sweep = base.reference.annotations.find((r) => r.id === "sweep-low")!;
  const pdh = base.reference.annotations.find((r) => r.id === "pdh")!;
  return { direction: "long" as const, entry: (fvg.priceHigh as number) - 4, stop: (sweep.price as number) - 6, target: (pdh.price as number) - 2, placedAt: at(9, 50) };
};

/** The same scenario with the path after `from` replaced by a drop, so a good process loses. */
function crashed(from: number): Scenario {
  const stream = base.data.stream.map(fromRow);
  const out = stream.map((c, i) => {
    if (i < from) return c;
    const o = i === from ? c.o : stream[i - 1].c - (i - from) * 3;
    const cl = o - 3;
    return { t: c.t, o, h: o + 0.5, l: cl - 0.5, c: cl };
  });
  return { ...base, data: { ...base.data, stream: out.map(toRow) } };
}

describe("acceptable answers", () => {
  it("gives full credit inside a range, graduated credit near it and none beyond", () => {
    const ranges = [{ low: 100, high: 110, soft: 10, label: "x" }];
    expect(creditForRange(ranges, 105).credit).toBe(1);
    const near = creditForRange(ranges, 115).credit;
    expect(near).toBeGreaterThan(0);
    expect(near).toBeLessThan(0.6);
    expect(creditForRange(ranges, 125).credit).toBe(0);
  });

  it("takes the best of several acceptable ranges", () => {
    const ranges = [
      { low: 100, high: 110, soft: 5, label: "a" },
      { low: 200, high: 210, soft: 5, label: "b", credit: 0.9 },
    ];
    expect(creditForRange(ranges, 205).credit).toBeCloseTo(0.9);
    expect(creditForRange(ranges, 105).credit).toBe(1);
  });

  it("allows several defensible choices with different credit", () => {
    const set = base.reference.decision;
    expect(creditForChoice(set, "long").credit).toBe(1);
    expect(creditForChoice(set, "wait").credit).toBeGreaterThan(0.5);
    expect(creditForChoice(set, "short").credit).toBe(0);
  });
});

describe("mark matching", () => {
  const refs = base.reference.annotations;

  it("matches a mark on structure and treats equally valid zones as alternatives", () => {
    const fvg = refs.find((r) => r.id === "fvg-5m")!;
    const ob = refs.find((r) => r.id === "ob-5m")!;
    for (const pick of [fvg, ob]) {
      const cmp = compareMarks([markOn(pick)], refs.filter((r) => r.kind === "fvg" || r.kind === "ob"));
      const s = scoreMarks(cmp, refs.filter((r) => r.kind === "fvg" || r.kind === "ob"));
      expect(cmp.missed.filter((m) => m.group === "poi")).toHaveLength(0);
      expect(s.credit).toBeGreaterThanOrEqual(0.9);
    }
  });

  it("calls a mark on the trap a trap, and one on nothing a false positive", () => {
    const bear = refs.find((r) => r.id === "bear-gap")!;
    const nowhere: Annotation = { id: "n", kind: "liquidity", price: 20000 };
    const cmp = compareMarks([markOn(bear), nowhere], refs);
    expect(cmp.trapped.map((t) => t.ref.id)).toEqual(["bear-gap"]);
    expect(cmp.unmatched.map((u) => u.id)).toEqual(["n"]);
  });

  it("does not let a box over the whole chart match a small zone", () => {
    const fvg = refs.find((r) => r.id === "fvg-5m")!;
    const huge: Annotation = { id: "h", kind: "fvg", priceLow: (fvg.priceLow as number) - 400, priceHigh: (fvg.priceHigh as number) + 400, tStart: fvg.tStart, tEnd: fvg.tEnd };
    expect(compareMarks([huge], refs).matched.filter((m) => m.ref.id === "fvg-5m")).toHaveLength(0);
  });

  it("credits a swing marker at less than a liquidity line, never ignoring it", () => {
    const pdh = refs.find((r) => r.id === "pdh")!;
    const line = compareMarks([{ id: "a", kind: "liquidity", price: pdh.price }], refs).matched.find((m) => m.ref.id === "pdh")!;
    const swing = compareMarks([{ id: "b", kind: "swing_high", price: pdh.price, t: pdh.t }], refs).matched.find((m) => m.ref.id === "pdh")!;
    expect(swing.credit).toBeLessThan(line.credit);
    expect(swing.credit).toBeGreaterThan(0);
  });

  it("ignores marks drawn with hindsight", () => {
    const fvg = refs.find((r) => r.id === "fvg-5m")!;
    const cmp = compareMarks([{ ...markOn(fvg), hindsight: true }], refs);
    expect(cmp.matched).toHaveLength(0);
    expect(cmp.unmatched).toHaveLength(0);
  });
});

describe("process scoring", () => {
  it("scores a sound process highly and records the win", () => {
    const r = scoreAttempt(base, MODES.simulator, replay({ order: idealOrder() }));
    expect(r.outcome.status).toBe("closed");
    if (r.outcome.status !== "closed") return;
    expect(r.outcome.exit).toBe("target");
    expect(r.outcome.resultR).toBeGreaterThan(1.5);
    expect(r.score).toBeGreaterThanOrEqual(90);
    expect(r.mistakes).toEqual([]);
  });

  it("gives a losing trade the SAME process score: outcome never enters it", () => {
    const win = scoreAttempt(base, MODES.simulator, replay({ order: idealOrder() }));
    const lossScenario = crashed(at(10, 8));
    const lose = scoreAttempt(lossScenario, MODES.simulator, replay({ order: idealOrder() }));
    expect(lose.outcome.status === "closed" && lose.outcome.resultR).toBeLessThan(0);
    expect(lose.score).toBe(win.score);
    expect(lose.score).toBeGreaterThanOrEqual(85);
    expect(lose.verdict).toBe("correct");
  });

  it("scores a winner low when it was entered before confirmation with a stop that does not protect it", () => {
    const stream = base.data.stream.map(fromRow);
    const placedAt = at(9, 36);
    const entryNow = stream[placedAt].o;
    const sloppy = replay({
      annotations: [],
      order: { direction: "long", entry: null, stop: entryNow - 10, target: (base.reference.annotations.find((r) => r.id === "pdh")!.price as number) - 2, placedAt },
      decidedAtRevealed: placedAt,
    });
    const r = scoreAttempt(base, MODES.simulator, sloppy);
    expect(r.outcome.status === "closed" && r.outcome.resultR).toBeGreaterThan(2);
    expect(r.score).toBeLessThanOrEqual(60);
    expect(r.mistakes).toContain("PREMATURE_ENTRY");
    expect(r.mistakes).toContain("STOP_TOO_TIGHT");
    expect(r.caps.length).toBeGreaterThan(0);
  });

  it("flags chasing: a market buy after the move has left the entry area", () => {
    const placedAt = at(9, 50);
    const r = scoreAttempt(
      base,
      MODES.simulator,
      replay({ order: { direction: "long", entry: null, stop: 21200, target: (base.reference.annotations.find((x) => x.id === "pdh")!.price as number) - 2, placedAt } }),
    );
    const entry = r.dimensions.find((d) => d.dimension === "entry_location")!;
    expect(entry.score).toBeLessThan(40);
    expect(r.mistakes).toContain("CHASED_DISPLACEMENT");
  });

  it("scores the wrong direction as against the higher timeframe", () => {
    const r = scoreAttempt(base, MODES.simulator, replay({ bias: "bearish", decision: "short", order: { direction: "short", entry: null, stop: 21400, target: 21100, placedAt: at(9, 50) } }));
    expect(r.score).toBeLessThan(50);
    expect(r.mistakes).toContain("AGAINST_HTF_BIAS");
  });

  it("treats waiting as defensible and standing aside as weak here, without inventing an order", () => {
    const wait = scoreAttempt(base, MODES.simulator, replay({ decision: "wait", order: null }));
    const none = scoreAttempt(base, MODES.simulator, replay({ decision: "no_trade", order: null }));
    expect(wait.outcome.status).toBe("no_order");
    const waitDim = wait.dimensions.find((d) => d.dimension === "trade_selection")!;
    const noneDim = none.dimensions.find((d) => d.dimension === "trade_selection")!;
    expect(waitDim.score).toBeGreaterThan(noneDim.score);
    expect(wait.correctAvoidance).toBeNull();
  });

  it("reports mode dimensions only for what the mode asked", () => {
    const r = scoreAttempt(base, MODES.setup_or_trap, {
      scenarioId: base.id,
      modeId: "setup_or_trap",
      confidence: 3,
      responseTimeMs: 1,
      stages: { take: { kind: "choice", value: "take" } },
    });
    expect(r.dimensions.map((d) => d.dimension)).toEqual(["trade_selection"]);
    expect(r.score).toBe(100);
  });

  it("scores a confluence pick by what carried the idea, and penalises padding", () => {
    const answer = (values: string[]): AttemptResponse => ({
      scenarioId: base.id,
      modeId: "confluence",
      confidence: null,
      responseTimeMs: 1,
      stages: { confluences: { kind: "multi", values }, take: { kind: "choice", value: "long" } },
    });
    const tight = scoreAttempt(base, MODES.confluence, answer(["sweep", "displace", "fvg", "htf"]));
    const padded = scoreAttempt(base, MODES.confluence, answer(["sweep", "displace", "fvg", "htf", "bear", "asia", "round"]));
    const missing = scoreAttempt(base, MODES.confluence, answer(["fvg", "htf"]));
    const sel = (r: typeof tight) => r.dimensions.find((d) => d.dimension === "confluence_selection")!.score;
    expect(sel(tight)).toBeGreaterThan(sel(padded));
    expect(sel(tight)).toBeGreaterThan(sel(missing));
  });
});

describe("review", () => {
  it("separates what was read, missed, irrelevant and weakening", () => {
    const r = scoreAttempt(base, MODES.simulator, replay({ annotations: [markOn(base.reference.annotations.find((a) => a.id === "pdh")!)], decision: "no_trade", order: null }));
    expect(r.review.readCorrectly.length).toBeGreaterThan(0);
    expect(r.review.missed.join(" ")).toMatch(/Overnight low/);
    expect(r.review.presentButIrrelevant.join(" ")).toMatch(/Asia high/);
    expect(r.review.lookForNextTime.length).toBeGreaterThan(0);
  });

  it("derives skill evidence from the applicable dimensions only", () => {
    const r = scoreAttempt(base, MODES.setup_or_trap, { scenarioId: base.id, modeId: "setup_or_trap", confidence: null, responseTimeMs: 1, stages: { take: { kind: "choice", value: "skip" } } });
    expect(r.skillEvidence.every((e) => e.score >= 0 && e.score <= 1 && e.weight > 0)).toBe(true);
    expect(new Set(r.skillEvidence.map((e) => e.skill))).toEqual(new Set(["execution", "confluence"]));
  });
});
