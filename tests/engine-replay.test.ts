import { describe, expect, it } from "vitest";
import { fromRow } from "@/lib/engine/candles";
import { initialReplay, reducer, type Action, type ReplayState } from "@/lib/engine/replay";
import { toPublicScenario } from "@/lib/engine/public";
import type { Scenario } from "@/lib/engine/types";
import sim001 from "@/data/sim-scenarios/sim-001.json";

const scenario = sim001 as unknown as Scenario;
const start = (): ReplayState => {
  const pub = toPublicScenario(scenario);
  const base = initialReplay(pub, "5m");
  // Everything fetched, as it is once the server has sent the rest.
  return reducer(base, { type: "append", rows: scenario.data.stream.slice(pub.stream.length).map(fromRow), done: true });
};
const run = (s: ReplayState, ...actions: Action[]) => actions.reduce(reducer, s);

describe("replay cursor", () => {
  it("starts at the decision moment with nothing beyond it revealed", () => {
    const s = initialReplay(toPublicScenario(scenario), "5m");
    expect(s.revealed).toBe(scenario.cursorStart);
    expect(s.candles).toHaveLength(scenario.cursorStart);
    expect(s.phase).toBe("reading");
  });

  it("advances, goes back and resets, but never behind the start", () => {
    let s = run(start(), { type: "advance", n: 5 });
    expect(s.revealed).toBe(scenario.cursorStart + 5);
    s = run(s, { type: "back" }, { type: "back" });
    expect(s.revealed).toBe(scenario.cursorStart + 3);
    s = run(s, { type: "reset" });
    expect(s.revealed).toBe(scenario.cursorStart);
    expect(run(s, { type: "back" }).revealed).toBe(scenario.cursorStart);
    // The high-water mark remembers how far it was seen.
    expect(s.highWater).toBe(scenario.cursorStart + 5);
  });

  it("can't advance past the candles it has", () => {
    const pub = toPublicScenario(scenario);
    const s = run(initialReplay(pub, "5m"), { type: "advance", n: 50 });
    expect(s.revealed).toBe(pub.stream.length);
  });
});

describe("commitment", () => {
  const withPlan = (s: ReplayState, direction: "long" | "short" = "long") => {
    const close = s.candles[s.revealed - 1].c;
    return run(s, { type: "bias", bias: "bullish" }, { type: "plan", plan: { direction, entry: null, stop: close - 60, target: close + 120 } });
  };

  it("commits only at the live edge: rewinding after seeing ahead can't be used to trade with hindsight", () => {
    let s = withPlan(start());
    s = run(s, { type: "advance", n: 10 }, { type: "back" });
    expect(s.revealed).toBeLessThan(s.highWater);
    expect(run(s, { type: "commit", decision: "long" }).phase).toBe("reading");
    expect(run(s, { type: "wait" }).waits).toBe(0);
    const live = run(s, { type: "live" }, { type: "commit", decision: "long" });
    expect(live.phase).toBe("committed");
  });

  it("refuses a plan whose direction doesn't match, or a stop on the wrong side", () => {
    const s = withPlan(start(), "short");
    expect(run(s, { type: "commit", decision: "long" }).phase).toBe("reading");
    const close = s.candles[s.revealed - 1].c;
    const bad = run(start(), { type: "plan", plan: { direction: "long", entry: null, stop: close + 10, target: close + 50 } });
    expect(run(bad, { type: "commit", decision: "long" }).phase).toBe("reading");
  });

  it("after a commit there's no rewinding, and the trade resolves on its own", () => {
    let s = run(withPlan(start()), { type: "commit", decision: "long" });
    expect(s.phase).toBe("committed");
    const at = s.revealed;
    s = run(s, { type: "back" }, { type: "reset" });
    expect(s.revealed).toBe(at);
    // Run it to the end of the data.
    for (let i = 0; i < 2000 && s.phase !== "resolved"; i++) s = run(s, { type: "advance", n: 5 });
    expect(s.phase).toBe("resolved");
    expect(s.orderState?.status).toBe("done");
  });

  it("no trade ends it at once with no order", () => {
    const s = run(start(), { type: "bias", bias: "neutral" }, { type: "commit", decision: "no_trade" });
    expect(s.phase).toBe("resolved");
    expect(s.order).toBeNull();
  });

  it("waiting advances to the next candle on the timeframe and counts", () => {
    const s = run(start(), { type: "tf", tf: "5m" }, { type: "wait" });
    expect(s.waits).toBe(1);
    expect(s.revealed).toBeGreaterThan(scenario.cursorStart);
    expect(s.revealed).toBeLessThanOrEqual(scenario.cursorStart + 5);
  });
});

describe("markup", () => {
  const mark = { kind: "liquidity" as const, price: 21300, t: 1 };
  it("adds, undoes and clears; marks drawn while rewound are flagged as hindsight", () => {
    let s = run(start(), { type: "add", a: mark });
    expect(s.annotations).toHaveLength(1);
    expect(s.annotations[0].hindsight).toBeUndefined();
    s = run(s, { type: "undo" });
    expect(s.annotations).toHaveLength(0);
    s = run(s, { type: "advance", n: 6 }, { type: "back" }, { type: "add", a: mark });
    expect(s.annotations[0].hindsight).toBe(true);
    s = run(s, { type: "clear" });
    expect(s.annotations).toHaveLength(0);
    expect(run(s, { type: "undo" }).annotations).toHaveLength(1);
  });

  it("gives every mark its own id and can delete the selected one", () => {
    let s = run(start(), { type: "add", a: mark }, { type: "add", a: { ...mark, price: 21320 } });
    expect(new Set(s.annotations.map((a) => a.id)).size).toBe(2);
    s = run(s, { type: "select", id: s.annotations[0].id }, { type: "deleteSelected" });
    expect(s.annotations).toHaveLength(1);
  });
});
