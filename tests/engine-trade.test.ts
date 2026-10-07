import { describe, expect, it } from "vitest";
import type { SimCandle } from "@/lib/engine/candles";
import { orderType, plannedRR, simulateOrder, stepOrder, startOrder, validateOrder } from "@/lib/engine/trade";
import type { Order } from "@/lib/engine/types";

const c = (t: number, o: number, h: number, l: number, cl: number): SimCandle => ({ t, o, h, l, c: cl });
const order = (o: Partial<Order>): Order => ({ direction: "long", entry: 100, stop: 90, target: 120, placedAt: 1, ...o });

describe("order types", () => {
  it("reads limit, stop-entry and market from the entry against the last close", () => {
    expect(orderType({ direction: "long", entry: 95 }, 100)).toBe("limit");
    expect(orderType({ direction: "long", entry: 105 }, 100)).toBe("stop");
    expect(orderType({ direction: "short", entry: 105 }, 100)).toBe("limit");
    expect(orderType({ direction: "short", entry: 95 }, 100)).toBe("stop");
    expect(orderType({ direction: "long", entry: null }, 100)).toBe("market");
  });
});

describe("order validation", () => {
  it("rejects a stop on the wrong side and a target on the wrong side", () => {
    expect(validateOrder(order({ stop: 101 }), 100).ok).toBe(false);
    expect(validateOrder(order({ target: 95 }), 100).ok).toBe(false);
    expect(validateOrder(order({ direction: "short", stop: 95, target: 80, entry: 100 }), 100).ok).toBe(false);
    expect(validateOrder(order({}), 100).ok).toBe(true);
  });
  it("rejects an entry far from price", () => {
    expect(validateOrder(order({ entry: 150, stop: 140, target: 180 }), 100).ok).toBe(false);
  });
});

describe("simulateOrder", () => {
  const stream = (rows: [number, number, number, number][]): SimCandle[] => rows.map(([o, h, l, cl], i) => c(i, o, h, l, cl));

  it("fills a long limit and reaches the target on a later candle", () => {
    const s = stream([
      [105, 106, 104, 105],
      [105, 106, 99, 102], // fills at 100 (low touches), stop 90 not hit
      [102, 125, 101, 124], // target 120 reached
    ]);
    const o = simulateOrder(order({ placedAt: 1 }), s, "1m");
    expect(o.status).toBe("closed");
    if (o.status !== "closed") return;
    expect(o.exit).toBe("target");
    expect(o.fillPrice).toBe(100);
    expect(o.resultR).toBeCloseTo(2, 5);
    expect(o.plannedRR).toBeCloseTo(2, 5);
    expect(o.mfeR).toBeCloseTo(2, 5);
  });

  it("takes the stop when one candle touches both stop and target", () => {
    const s = stream([
      [105, 106, 104, 105],
      [105, 106, 101, 103],
      [103, 125, 85, 100], // both
    ]);
    const o = simulateOrder(order({ placedAt: 1, entry: null, stop: 90, target: 120 }), s, "1m");
    expect(o.status === "closed" && o.exit).toBe("stop");
    if (o.status === "closed") {
      expect(o.resultR).toBeCloseTo(-1, 5); // a stop is -1R by construction
    }
  });

  it("does not let the target end a trade on the candle a resting order filled", () => {
    const s = stream([
      [105, 106, 104, 105],
      [105, 125, 99, 124], // fills at 100 AND touches 120: only the stop can end it here
      [124, 126, 122, 125],
    ]);
    const o = simulateOrder(order({ placedAt: 1 }), s, "1m");
    expect(o.status === "closed" && o.exit).toBe("target");
    if (o.status === "closed") expect(o.exitIndex).toBe(2);
  });

  it("cancels an unfilled order when price reaches the target first", () => {
    const s = stream([
      [105, 106, 104, 105],
      [105, 125, 104, 124],
    ]);
    const o = simulateOrder(order({ placedAt: 1 }), s, "1m");
    expect(o).toMatchObject({ status: "unfilled", reason: "target_first" });
  });

  it("cancels a buy-stop when price breaks the stop level without filling", () => {
    const s = stream([
      [100, 101, 99, 100],
      [100, 101, 85, 86],
    ]);
    const o = simulateOrder(order({ placedAt: 1, entry: 105, stop: 90, target: 130 }), s, "1m");
    expect(o).toMatchObject({ status: "unfilled", reason: "invalidated" });
  });

  it("marks an open trade at the last close when the scenario ends", () => {
    const s = stream([
      [105, 106, 104, 105],
      [105, 106, 99, 102],
      [102, 108, 101, 107],
    ]);
    const o = simulateOrder(order({ placedAt: 1 }), s, "1m");
    expect(o.status === "closed" && o.exit).toBe("scenario_end");
    if (o.status === "closed") expect(o.resultR).toBeCloseTo(0.7, 5);
  });

  it("reports a short in R with the sign flipped", () => {
    const s = stream([
      [95, 96, 94, 95],
      [95, 101, 94, 99], // short limit at 100 fills
      [99, 100, 78, 79], // target 80 reached
    ]);
    const o = simulateOrder({ direction: "short", entry: 100, stop: 110, target: 80, placedAt: 1 }, s, "1m");
    expect(o.status === "closed" && o.exit).toBe("target");
    if (o.status === "closed") expect(o.resultR).toBeCloseTo(2, 5);
  });

  it("measures adverse and favourable excursion in R", () => {
    const s = stream([
      [105, 106, 104, 105],
      [105, 106, 99, 103], // fill 100
      [103, 112, 96, 111], // adverse 4 (96), favourable 12
      [111, 125, 110, 124], // target
    ]);
    const o = simulateOrder(order({ placedAt: 1 }), s, "1m");
    expect(o.status).toBe("closed");
    if (o.status !== "closed") return;
    expect(o.maeR).toBeCloseTo(0.4, 5); // 4 points against, risk 10
    expect(o.mfeR).toBeCloseTo(2, 5);
  });

  it("steps one candle at a time to the same result", () => {
    const s = stream([
      [105, 106, 104, 105],
      [105, 106, 99, 102],
      [102, 125, 101, 124],
    ]);
    let state = startOrder(order({ placedAt: 1 }), 105);
    let ended = false;
    for (let i = 1; i < s.length && !ended; i++) {
      const step = stepOrder(state, s[i], i, "1m");
      state = step.state;
      ended = step.ended;
    }
    expect(state.status).toBe("done");
  });

  it("computes planned R:R", () => {
    expect(plannedRR("long", 100, 90, 130)).toBeCloseTo(3, 5);
    expect(plannedRR("long", 100, 110, 130)).toBeNull();
  });
});
