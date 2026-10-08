// "What happens next": the answer key for the most likely next objective,
// derived from the candles rather than typed in. At the chosen candle the
// visible chart offers a handful of objectives (the previous day's high and
// low, the nearest swing high or low, the nearest unfilled gap); the future
// portion says which of them price actually went to. The draw is the
// farthest liquidity it reached on the side it travelled; anything else it
// also reached is defensible at partial credit, a buy-side answer for a
// previous-day-high run is partly right, and "consolidation" is the answer
// only when price reached nothing and stayed in a narrow range. A scenario
// where none of that holds yields no answer, so the mode is not offered on
// it. Nothing about this predicts the next candle: it is a read of where
// price was likely to be drawn.

import { fromRow, resample, type SimCandle } from "@/lib/engine/candles";
import { atr, fvgs } from "@/lib/engine/structure";
import type { AcceptableSet, Scenario } from "@/lib/engine/types";

export const OBJECTIVES = ["bsl", "ssl", "pdh", "pdl", "fvg", "consolidation"] as const;
export type Objective = (typeof OBJECTIVES)[number];

export const OBJECTIVE_LABEL: Record<Objective, string> = {
  bsl: "Buy-Side Liquidity",
  ssl: "Sell-Side Liquidity",
  pdh: "Previous Day High",
  pdl: "Previous Day Low",
  fvg: "FVG / imbalance repricing",
  consolidation: "Consolidation / unclear",
};

/** Tunable, in one place. */
export const NEXT_OBJECTIVE = {
  /** Touch tolerance and "near the same level", in 5m ranges. */
  touch: 0.5,
  sameLevel: 3,
  /** A gap counts as nearby within this many 5m ranges of price. */
  gapReach: 4,
  /** A pool beyond the previous day must sit this many 5m ranges from price. */
  poolMin: 1.5,
  /** Share of the way to a pool price must travel to count as drawn to it. */
  approach: 0.7,
  /** Smallest gap worth naming, in 5m ranges. */
  gapMin: 0.3,
  /** "Stayed narrow": the whole future inside this many 5m ranges. */
  narrow: 4,
  /** Fewest future candles before a scenario can ask the question. */
  minFuture: 15,
  partial: 0.75,
  crossCredit: 0.7,
};

type Level = { price: number; desc: string };

const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 2 });

export function deriveNextObjective(s: Pick<Scenario, "data" | "cursorStart">): { set: AcceptableSet<Objective>; draw: Objective | null } | null {
  const stream = s.data.stream.map(fromRow);
  const visible = stream.slice(0, s.cursorStart);
  const future = stream.slice(s.cursorStart);
  if (visible.length < 30 || future.length < NEXT_OBJECTIVE.minFuture) return null;

  const p0 = visible[visible.length - 1].c;
  const c5 = resample(visible, "5m").slice(0, -1);
  const a5 = atr(c5, 20);
  if (a5 <= 0) return null;
  const tol = NEXT_OBJECTIVE.touch * a5;
  const prevDay = s.data.history["1D"]?.at(-1);

  const levels = new Map<Objective, Level>();
  if (prevDay) {
    const [, , pdh, pdl] = prevDay;
    if (pdh > p0 + tol) levels.set("pdh", { price: pdh, desc: `the previous day high (${fmt(pdh)})` });
    if (pdl < p0 - tol) levels.set("pdl", { price: pdl, desc: `the previous day low (${fmt(pdl)})` });
  }
  // The day's extremes so far are the pools that matter beyond the previous day's range.
  const dayHigh = Math.max(...visible.map((c) => c.h));
  const dayLow = Math.min(...visible.map((c) => c.l));
  const far = NEXT_OBJECTIVE.poolMin * a5;
  const near = (price: number, other?: Level) => other !== undefined && Math.abs(price - other.price) < NEXT_OBJECTIVE.sameLevel * tol;
  if (dayHigh > p0 + far && !near(dayHigh, levels.get("pdh"))) levels.set("bsl", { price: dayHigh, desc: `the day's high (${fmt(dayHigh)})` });
  if (dayLow < p0 - far && !near(dayLow, levels.get("pdl"))) levels.set("ssl", { price: dayLow, desc: `the day's low (${fmt(dayLow)})` });

  // The nearest gap nothing has traded back into yet.
  const gaps = fvgs(c5, "5m", NEXT_OBJECTIVE.gapMin * a5)
    .filter((g) => !c5.slice(g.index + 2).some((c) => c.l <= g.high && c.h >= g.low))
    .filter((g) => p0 < g.low || p0 > g.high)
    .map((g) => ({ g, edge: p0 < g.low ? g.low : g.high }))
    .filter((x) => Math.abs(x.edge - p0) <= NEXT_OBJECTIVE.gapReach * a5)
    .sort((a, b) => Math.abs(a.edge - p0) - Math.abs(b.edge - p0));
  const gap = gaps[0];
  if (gap) levels.set("fvg", { price: gap.edge, desc: `the unfilled gap at ${fmt(gap.g.low)} to ${fmt(gap.g.high)}` });

  // A pool counts as drawn to once price touched it or travelled most of the way.
  const reached = new Map<Objective, number>();
  for (const [k, lv] of levels) {
    const above = lv.price > p0;
    const dist = Math.abs(lv.price - p0);
    // How far toward it counts: a gap is touched, a pool is approached.
    const slack = k === "fvg" ? tol : dist * (1 - NEXT_OBJECTIVE.approach);
    const threshold = above ? lv.price - slack : lv.price + slack;
    const i = future.findIndex((c: SimCandle) => (above ? c.h >= threshold : c.l <= threshold));
    if (i >= 0) reached.set(k, i);
  }

  const range = Math.max(...future.map((c) => c.h)) - Math.min(...future.map((c) => c.l));
  const narrow = range <= NEXT_OBJECTIVE.narrow * a5;
  const net = future[future.length - 1].c - p0;
  const side = (k: Objective) => ((levels.get(k) as Level).price > p0 ? 1 : -1);

  const liquidity = (["pdh", "pdl", "bsl", "ssl"] as const).filter((k) => reached.has(k));
  let draw: Objective | null = null;
  if (narrow && !liquidity.some((k) => k === "pdh" || k === "pdl")) {
    draw = "consolidation";
  } else if (liquidity.length > 0) {
    const onNetSide = liquidity.filter((k) => (side(k) > 0) === net > 0);
    const pool = onNetSide.length > 0 ? onNetSide : liquidity;
    draw = [...pool].sort((a, b) => Math.abs((levels.get(b) as Level).price - p0) - Math.abs((levels.get(a) as Level).price - p0))[0];
  } else if (reached.has("fvg")) {
    draw = "fvg";
  } else {
    return null;
  }
  const drawAt = draw === "consolidation" ? Infinity : (reached.get(draw) as number);
  const credit: Partial<Record<Objective, number>> = { [draw]: 1 };
  // Other pools price ran to on the way, on the same side, before the draw: defensible.
  const enRoute = [...reached].filter(([k, i]) => k !== draw && i <= drawAt && (k === "fvg" || draw === "consolidation" || draw === "fvg" || side(k) === side(draw as Objective))).map(([k]) => k);
  for (const k of enRoute) if (draw !== "consolidation") credit[k] = NEXT_OBJECTIVE.partial;
  // A previous-day high is buy-side liquidity, and the reverse: right on the side, less exact.
  const cross = (a: Objective, b: Objective) => {
    if ((credit[a] ?? 0) >= NEXT_OBJECTIVE.partial && credit[b] === undefined) credit[b] = NEXT_OBJECTIVE.crossCredit;
  };
  cross("pdh", "bsl");
  cross("bsl", "pdh");
  cross("pdl", "ssl");
  cross("ssl", "pdl");
  if (draw === "fvg" && narrow) credit.consolidation = 0.5;
  if (draw === "consolidation" && reached.has("fvg")) credit.fvg = 0.5;

  const reachedList = enRoute.map((k) => (levels.get(k) as Level).desc);
  const why =
    draw === "consolidation"
      ? `Price reached none of the pools in view (the previous day's range, the nearest swings, the nearest gap) and stayed inside a narrow range. With no pool drawing it, "no clear objective" was the read that held up.`
      : `Price was drawn to ${(levels.get(draw) as Level).desc}${reachedList.length > 0 ? `; it also traded to ${reachedList.join(" and ")} on the way, which makes those defensible too` : ""}. The question is where price was likely to be pulled, not what the next candle would do.${draw === "pdh" || draw === "pdl" ? " A previous-day extreme is also a pool of buy-side or sell-side liquidity, so that answer is right on the side, if less exact." : ""}`;

  return { set: { why, options: OBJECTIVES.map((value) => ({ value, credit: Math.round((credit[value] ?? 0) * 100) / 100 })) }, draw };
}
