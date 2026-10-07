// Order execution over a candle stream: when an order fills, when the trade
// ends, what it returned in R and how far it moved for and against. Pure, and
// the one implementation the simulator's client and the server's grading both
// run, so what a trader watches resolve is exactly what is recorded.
//
// Fill and exit rules (stated here and in docs/ENGINE.md because they decide
// results, and the data cannot say which happened first inside one candle):
//   - at market fills at the open of the first candle after the order;
//   - a limit order fills when price trades through it (at the open if the
//     candle gaps through, better than asked); a stop-entry fills when price
//     trades up through it for a long, down through it for a short;
//   - on a candle that touches both the stop and the target the stop is
//     assumed to come first, the worse case;
//   - on the candle a limit or stop-entry fills, only the stop can end the
//     trade: whether the target was reached before or after the fill is
//     unknowable, so it waits for the next candle;
//   - an unfilled order is cancelled if price reaches the target first (the
//     move happened without you) or the stop first (the idea is invalidated);
//   - results are R multiples, never dollars.

import type { SimCandle } from "@/lib/engine/candles";
import type { Timeframe } from "@/lib/engine/time";
import type { Direction, FillResult, Order, TradeOutcome } from "@/lib/engine/types";

export type OrderCheck = { ok: true } | { ok: false; reason: string };

/** The order type a user's entry price implies against the last close:
 * entry at/through the market is "market", resting away from it is a limit
 * (waiting for price to come to you) or a stop-entry (waiting for price to
 * break through). */
export function orderType(order: Pick<Order, "direction" | "entry">, lastClose: number): FillResult {
  if (order.entry === null) return "market";
  if (order.direction === "long") return order.entry <= lastClose ? "limit" : "stop";
  return order.entry >= lastClose ? "limit" : "stop";
}

export function validateOrder(order: Order, lastClose: number): OrderCheck {
  const finite = [order.stop, order.target, ...(order.entry === null ? [] : [order.entry])].every((n) => Number.isFinite(n));
  if (!finite) return { ok: false, reason: "Enter a price for the stop and target." };
  const entry = order.entry ?? lastClose;
  const long = order.direction === "long";
  if (long ? order.stop >= entry : order.stop <= entry) return { ok: false, reason: `A ${order.direction} needs its stop ${long ? "below" : "above"} the entry.` };
  if (long ? order.target <= entry : order.target >= entry) return { ok: false, reason: `A ${order.direction} needs its target ${long ? "above" : "below"} the entry.` };
  if (Math.abs(entry - lastClose) > Math.abs(lastClose) * 0.1) return { ok: false, reason: "That entry is more than 10% away from price." };
  return { ok: true };
}

/** Risk-to-reward of an order from its entry (or a reference price). */
export function plannedRR(direction: Direction, entry: number, stop: number, target: number): number | null {
  const risk = direction === "long" ? entry - stop : stop - entry;
  const reward = direction === "long" ? target - entry : entry - target;
  if (risk <= 0 || reward <= 0) return null;
  return reward / risk;
}

export type OrderState =
  | { status: "pending"; order: Order; type: FillResult }
  | {
      status: "open";
      order: Order;
      type: FillResult;
      fillIndex: number;
      fillPrice: number;
      /** Greatest distance against / in favour of the trade so far, in price. */
      adverse: number;
      favorable: number;
    }
  | { status: "done"; outcome: TradeOutcome };

export function startOrder(order: Order, lastClose: number): OrderState {
  return { status: "pending", order, type: orderType(order, lastClose) };
}

type Step = { state: OrderState; ended: boolean };

function fillFor(order: Order, type: FillResult, c: SimCandle): number | null {
  if (type === "market") return c.o;
  const p = order.entry as number;
  if (order.direction === "long") {
    if (type === "limit") return c.l <= p ? (c.o <= p ? c.o : p) : null;
    return c.h >= p ? (c.o >= p ? c.o : p) : null;
  }
  if (type === "limit") return c.h >= p ? (c.o >= p ? c.o : p) : null;
  return c.l <= p ? (c.o <= p ? c.o : p) : null;
}

function closed(
  state: Extract<OrderState, { status: "open" }>,
  exit: "stop" | "target" | "scenario_end",
  exitIndex: number,
  exitPrice: number,
  granularity: Timeframe,
): TradeOutcome {
  const { order, fillPrice } = state;
  const long = order.direction === "long";
  const risk = long ? fillPrice - order.stop : order.stop - fillPrice;
  const move = long ? exitPrice - fillPrice : fillPrice - exitPrice;
  const reward = long ? order.target - fillPrice : fillPrice - order.target;
  const safeRisk = risk > 0 ? risk : Math.abs(fillPrice) * 1e-9;
  const resultR = move / safeRisk;
  const mae = exit === "stop" ? safeRisk : Math.min(state.adverse, safeRisk);
  const mfe = exit === "target" ? Math.max(0, reward) : state.favorable;
  return {
    status: "closed",
    exit,
    fillIndex: state.fillIndex,
    fillPrice,
    fillType: state.type,
    exitIndex,
    exitPrice,
    resultR,
    plannedRR: reward > 0 && risk > 0 ? reward / risk : 0,
    maeR: mae / safeRisk,
    mfeR: mfe / safeRisk,
    bars: exitIndex - state.fillIndex + 1,
    granularity,
  };
}

/** Advances an order by one candle (the candle at stream index `index`). */
export function stepOrder(state: OrderState, c: SimCandle, index: number, granularity: Timeframe): Step {
  if (state.status === "done") return { state, ended: true };
  const { order } = state;
  const long = order.direction === "long";

  let open: Extract<OrderState, { status: "open" }>;
  let filledThisCandle = false;

  if (state.status === "pending") {
    const fill = fillFor(order, state.type, c);
    if (fill === null) {
      // Not filled: the move may have run away from the entry or broken the idea.
      const hitTarget = long ? c.h >= order.target : c.l <= order.target;
      const hitStop = long ? c.l <= order.stop : c.h >= order.stop;
      if (hitStop) return { state: { status: "done", outcome: { status: "unfilled", reason: "invalidated", endIndex: index } }, ended: true };
      if (hitTarget) return { state: { status: "done", outcome: { status: "unfilled", reason: "target_first", endIndex: index } }, ended: true };
      return { state, ended: false };
    }
    const risk = long ? fill - order.stop : order.stop - fill;
    if (risk <= 0) {
      // Gapped through the stop on the way in: the order is void.
      return { state: { status: "done", outcome: { status: "unfilled", reason: "invalidated", endIndex: index } }, ended: true };
    }
    open = { status: "open", order, type: state.type, fillIndex: index, fillPrice: fill, adverse: 0, favorable: 0 };
    filledThisCandle = true;
  } else {
    open = state;
  }

  // Excursions. On the fill candle of a resting order only the close counts
  // for the favourable side: the high may have come before the fill.
  const adverse = Math.max(open.adverse, long ? open.fillPrice - c.l : c.h - open.fillPrice, 0);
  const rawFavorable = long ? c.h - open.fillPrice : open.fillPrice - c.l;
  const closeFavorable = long ? c.c - open.fillPrice : open.fillPrice - c.c;
  const favorable = Math.max(open.favorable, filledThisCandle && open.type !== "market" ? Math.max(0, closeFavorable) : Math.max(0, rawFavorable));
  const priorFavorable = open.favorable;
  open = { ...open, adverse, favorable };

  const hitStop = long ? c.l <= order.stop : c.h >= order.stop;
  const hitTarget = long ? c.h >= order.target : c.l <= order.target;
  const targetCounts = !(filledThisCandle && open.type !== "market");
  // A stop ended it: this candle's favourable move may have come after the stop.
  if (hitStop) return { state: { status: "done", outcome: closed({ ...open, favorable: priorFavorable }, "stop", index, order.stop, granularity) }, ended: true };
  if (hitTarget && targetCounts) return { state: { status: "done", outcome: closed(open, "target", index, order.target, granularity) }, ended: true };
  return { state: open, ended: false };
}

/** Runs an order to its end over `stream` from the candle after it was
 * placed: until the stop or target is hit, a pending order is cancelled, or
 * the scenario ends. */
export function simulateOrder(order: Order, stream: readonly SimCandle[], granularity: Timeframe): TradeOutcome {
  const lastClose = stream[order.placedAt - 1]?.c ?? stream[0]?.o ?? order.stop;
  let state = startOrder(order, lastClose);
  for (let i = Math.max(0, order.placedAt); i < stream.length; i++) {
    const step = stepOrder(state, stream[i], i, granularity);
    state = step.state;
    if (step.ended) break;
  }
  return settleAtEnd(state, stream, granularity);
}

/** An order still live when the data runs out: pending ones never filled,
 * open ones are marked at the last close. */
export function settleAtEnd(state: OrderState, stream: readonly SimCandle[], granularity: Timeframe): TradeOutcome {
  if (state.status === "done") return state.outcome;
  const lastIndex = stream.length - 1;
  if (state.status === "pending") return { status: "unfilled", reason: "scenario_end", endIndex: lastIndex };
  return closed(state, "scenario_end", lastIndex, stream[lastIndex].c, granularity);
}

/** Outcome label for a feed that may be mid-trade. */
export function describeOutcome(o: TradeOutcome): string {
  switch (o.status) {
    case "no_order":
      return "No trade taken";
    case "unfilled":
      return o.reason === "target_first"
        ? "Never filled: price reached the target without trading to your entry"
        : o.reason === "invalidated"
          ? "Never filled: price broke the stop level first, so the idea was off"
          : "Never filled before the scenario ended";
    case "closed": {
      const r = `${o.resultR >= 0 ? "+" : "−"}${Math.abs(o.resultR).toFixed(2)}R`;
      return o.exit === "stop" ? `Stopped out, ${r}` : o.exit === "target" ? `Target reached, ${r}` : `Still open at the end, marked at ${r}`;
    }
  }
}
