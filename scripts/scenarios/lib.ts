// Scenario authoring kit (docs/ENGINE.md → Authoring). A spec describes a
// price path as legs between clock times, on top of a generated backdrop for
// the higher-timeframe context; the kit builds the 1-minute series, resamples
// every higher timeframe from it (so the same moment is the same on every
// chart by construction), and hands the spec's `build` function a context
// that finds structure BY CODE: swings, gaps, candle ranges. Reference
// markings are therefore read off the generated data, never typed in, and
// `npm run scenarios -- inspect <id>` prints what exists so a spec can name it.
//
// Everything built here is SEEDED data, clearly labelled so in the app. It
// is not market history, and nothing in it pretends to be.

import { fromRow, resample, toRow, type SimCandle } from "../../src/lib/engine/candles";
import { atr, fvgs, swings } from "../../src/lib/engine/structure";
import { bucketStart, etFields, etMinutes, TIMEFRAME_MINUTES, type Timeframe } from "../../src/lib/engine/time";
import type { AcceptableRange, AcceptableSet, AnnotationKind, Checkpoints, ConfluenceRef, Order, RefAnnotation, RefRole, Scenario } from "../../src/lib/engine/types";

/** [trading-day index, "HH:MM" ET]. Day 0 is the first Monday; times from
 * 18:00 belong to the evening session that opens that trading day. */
export type Clock = [number, string];

export const MINUTES_PER_DAY = 23 * 60;
const TICK = 0.25;
const snap = (p: number) => Math.round(p / TICK) * TICK;

// ---- Random -------------------------------------------------------------

export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gauss(r: () => number): number {
  const u = Math.max(r(), 1e-9);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r());
}

// ---- Timeline -----------------------------------------------------------

export type Calendar = { start: [number, number, number]; days: number };

/** The first calendar date of trading day `d` (weekdays only). */
function tradingDate(cal: Calendar, d: number): number {
  const [y, m, day] = cal.start;
  let t = Date.UTC(y, m - 1, day);
  let n = 0;
  while (n < d) {
    t += 86400000;
    const wd = new Date(t).getUTCDay();
    if (wd !== 0 && wd !== 6) n += 1;
  }
  return t;
}

export function buildTimeline(cal: Calendar): number[] {
  const out: number[] = [];
  for (let d = 0; d < cal.days; d++) {
    const date = tradingDate(cal, d);
    // The session opens 18:00 on the previous calendar day (Sunday for Monday).
    const open = date / 60000 - 1440 + 18 * 60;
    for (let i = 0; i < MINUTES_PER_DAY; i++) out.push(open + i);
  }
  return out;
}

export function clockToT(cal: Calendar, [d, time]: Clock): number {
  const [hh, mm] = time.split(":").map(Number);
  const date = tradingDate(cal, d) / 60000;
  return hh >= 18 ? date - 1440 + hh * 60 + mm : date + hh * 60 + mm;
}

export function tToClock(cal: Calendar, t: number): string {
  for (let d = 0; d < cal.days; d++) {
    const open = clockToT(cal, [d, "18:00"]);
    if (t >= open && t < open + MINUTES_PER_DAY) {
      const f = etFields(t);
      return `D${d} ${String(f.hour).padStart(2, "0")}:${String(f.minute).padStart(2, "0")}`;
    }
  }
  return String(t);
}

// ---- Path ---------------------------------------------------------------

/** What a leg's target can read: the price now, and the highs/lows of any
 * stretch already generated (so a sweep can be "12 points under the
 * overnight low" without knowing that number in advance). */
export type Hist = {
  price: number;
  hi: (from: Clock, to: Clock) => number;
  lo: (from: Clock, to: Clock) => number;
};

export type Leg = {
  to: number | ((h: Hist) => number);
  /** End of the leg, as a clock time or as a number of minutes after the last leg. */
  until?: Clock;
  minutes?: number;
  /** Noise per minute, in points (before the session profile). Default 2. */
  vol?: number;
  /** Largest bridge deviation, in points: keeps a chop leg inside a band. */
  maxDev?: number;
  /** Wick size relative to vol. */
  wick?: number;
};

/** Volatility by time of day: quiet Asia, busier London, loud NY open. */
function sessionVol(minuteOfDay: number): number {
  const h = minuteOfDay / 60;
  if (h >= 18 || h < 3) return 0.55;
  if (h < 8) return 0.85;
  if (h < 9.5) return 1.1;
  if (h < 11.5) return 1.6;
  if (h < 13.5) return 0.8;
  if (h < 16) return 1.2;
  return 0.7;
}

function runLeg(r: () => number, from: number, leg: Leg & { to: number }, times: number[]): number[] {
  const n = times.length;
  const vol = leg.vol ?? 2;
  const walk = new Array<number>(n + 1).fill(0);
  for (let i = 1; i <= n; i++) {
    const mod = times[i - 1] % 1440;
    walk[i] = walk[i - 1] + gauss(r) * vol * sessionVol(mod);
  }
  // Bridge: the noise returns to zero at the leg's end so it lands on `to`.
  let maxAbs = 0;
  const bridge = walk.map((w, i) => {
    const b = w - (i / n) * walk[n];
    if (Math.abs(b) > maxAbs) maxAbs = Math.abs(b);
    return b;
  });
  const scale = leg.maxDev && maxAbs > leg.maxDev ? leg.maxDev / maxAbs : 1;
  const closes: number[] = [];
  for (let i = 1; i <= n; i++) closes.push(from + (leg.to - from) * (i / n) + bridge[i] * scale);
  return closes;
}

function candlesFrom(r: () => number, start: number, times: number[], closes: number[], legVols: number[], legWicks: number[]): SimCandle[] {
  const out: SimCandle[] = [];
  let prev = start;
  for (let i = 0; i < closes.length; i++) {
    const sv = sessionVol(times[i] % 1440);
    const wickSigma = legVols[i] * legWicks[i] * sv;
    const o = prev;
    const c = closes[i];
    const up = Math.abs(gauss(r)) * wickSigma;
    const down = Math.abs(gauss(r)) * wickSigma;
    const so = snap(o);
    const sc = snap(c);
    out.push({ t: times[i], o: so, h: snap(Math.max(o, c) + up), l: snap(Math.min(o, c) - down), c: sc });
    // The next candle opens where this one closed, to the tick.
    prev = sc;
  }
  return out;
}

// ---- Backdrop -----------------------------------------------------------

export type BackdropKind = "uptrend" | "downtrend" | "range" | "rally_then_stall" | "decline_then_stall";

export type Backdrop = {
  kind: BackdropKind;
  days: number;
  /** Typical swing size in points (default 190). */
  amp?: number;
};

export function backdropLegs(r: () => number, start: number, b: Backdrop): Leg[] {
  const total = b.days * MINUTES_PER_DAY;
  const amp = b.amp ?? 190;
  const legs: Leg[] = [];
  let used = 0;
  let price = start;
  let up = b.kind === "uptrend" || b.kind === "range" || b.kind === "rally_then_stall";
  if (b.kind === "range") up = r() > 0.5;
  const lo = start - amp * 0.8;
  const hi = start + amp * 0.8;
  while (used < total) {
    const remaining = total - used;
    const minutes = Math.min(remaining, Math.round((300 + r() * 540) * (up ? 1.1 : 0.8)));
    const last = remaining - minutes < 240;
    const span = last ? remaining : minutes;
    let move: number;
    if (b.kind === "range") {
      const target = up ? hi - r() * amp * 0.25 : lo + r() * amp * 0.25;
      move = target - price;
    } else {
      const trendUp = b.kind === "uptrend" || b.kind === "rally_then_stall";
      const withTrend = up === trendUp;
      const size = amp * (0.8 + r() * 0.6);
      move = (up ? 1 : -1) * (withTrend ? size : size * (0.38 + r() * 0.22));
      if ((b.kind === "rally_then_stall" || b.kind === "decline_then_stall") && used > total * 0.65) move *= 0.35;
    }
    price += move;
    legs.push({ to: price, minutes: span, vol: 1.6 + r() * 0.8, wick: 1.1 });
    used += span;
    up = !up;
  }
  return legs;
}

/** Highest/lowest close so far inside a clock window (the path's closes: the
 * wicks are added later, so this is the level the path itself reached). */
function extremeOf(times: number[], closes: number[], _vols: number[], _wicks: number[], cal: Calendar, from: Clock, to: Clock, which: "hi" | "lo"): number {
  const a = clockToT(cal, from);
  const b = clockToT(cal, to);
  let v = which === "hi" ? -Infinity : Infinity;
  for (let i = 0; i < times.length; i++) {
    if (times[i] < a || times[i] > b) continue;
    v = which === "hi" ? Math.max(v, closes[i]) : Math.min(v, closes[i]);
  }
  if (!Number.isFinite(v)) throw new Error(`no generated candles between ${JSON.stringify(from)} and ${JSON.stringify(to)} yet`);
  return v;
}

// ---- Spec and build -----------------------------------------------------

export type ScenarioSpec = {
  id: string;
  seed: number;
  calendar: Calendar;
  startPrice: number;
  backdrop: Backdrop;
  /** The authored story, in clock order, continuing from the backdrop. */
  legs: Leg[];
  /** The trading day whose 18:00 open is the stream's first candle. */
  anchorDay: number;
  /** The moment the user first sees: the cursor starts after this candle closes. */
  decision: Clock;
  /** Where the scenario's data stops. */
  end: Clock;
  checkpoints?: Record<string, Clock>;
  /** History budget per timeframe (candles kept before the anchor). */
  historyBars?: Partial<Record<Timeframe, number>>;
  build: (c: Ctx) => Omit<Scenario, "data" | "cursorStart" | "checkpoints" | "id" | "provenance">;
  /** The order a careful trader would place, and what it must do in this
   * data. Checked at build time, so a spec cannot claim a winner that the
   * generated path does not deliver (or a failed setup that wins). */
  ideal?: (c: Ctx) => { order: Order; expect: "target" | "stop" | "unfilled" };
};

export type Geometry = { priceLow: number; priceHigh: number; tStart: number; tEnd: number };

/** What a spec's build function sees: the generated data and finders that
 * read structure off it. Every finder throws a readable error when nothing is
 * there, so a spec cannot quietly reference a swing or gap that does not exist. */
export type Ctx = {
  cal: Calendar;
  all: SimCandle[];
  series: (tf: Timeframe) => SimCandle[];
  t: (clock: Clock) => number;
  /** Stream candles revealed once the 1m candle opening at `clock` has closed. */
  revealedAfter: (clock: Clock) => number;
  /** Stream candles revealed once the `tf` candle opening at `clock` has closed. */
  revealedAtClose: (tf: Timeframe, clock: Clock) => number;
  close: (clock: Clock) => number;
  /** Highest high among the `tf` candles near `clock` (±window candles). */
  swingHigh: (tf: Timeframe, clock: Clock, window?: number) => { price: number; t: number };
  swingLow: (tf: Timeframe, clock: Clock, window?: number) => { price: number; t: number };
  /** The first FVG on `tf` whose middle candle is at/after `clock`. */
  fvg: (tf: Timeframe, clock: Clock, direction: "bullish" | "bearish", within?: number) => Geometry;
  /** A single candle's range on `tf`. */
  candle: (tf: Timeframe, clock: Clock) => Geometry;
  /** High/low of an interval. */
  extremes: (from: Clock, to: Clock) => { high: number; low: number; highT: number; lowT: number };
  atr: (tf: Timeframe, clock: Clock, n?: number) => number;
};

function makeCtx(cal: Calendar, all: SimCandle[], anchorT: number): Ctx {
  const cache = new Map<Timeframe, SimCandle[]>();
  const series = (tf: Timeframe) => {
    let s = cache.get(tf);
    if (!s) {
      s = tf === "1m" ? all : resample(all, tf);
      cache.set(tf, s);
    }
    return s;
  };
  const t = (clock: Clock) => clockToT(cal, clock);
  const indexNear = (s: SimCandle[], when: number) => {
    let lo = 0;
    let hi = s.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (s[mid].t < when) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  };
  const streamIndex = (when: number) => all.findIndex((c) => c.t >= anchorT && c.t === when) - all.findIndex((c) => c.t === anchorT);
  return {
    cal,
    all,
    series,
    t,
    revealedAfter: (clock) => {
      const idx = streamIndex(t(clock));
      if (idx < 0) throw new Error(`clock ${clock} is not inside the stream`);
      return idx + 1;
    },
    revealedAtClose: (tf, clock) => {
      const start = bucketStart(t(clock), tf);
      const lastMinute = start + TIMEFRAME_MINUTES[tf] - 1;
      const idx = streamIndex(lastMinute);
      if (idx < 0) throw new Error(`clock ${clock} (${tf}) is not inside the stream`);
      return idx + 1;
    },
    close: (clock) => {
      const c = all.find((x) => x.t === t(clock));
      if (!c) throw new Error(`no candle at ${clock}`);
      return c.c;
    },
    swingHigh: (tf, clock, window = 3) => {
      const s = series(tf);
      const i = indexNear(s, t(clock));
      let best = s[i];
      for (let j = Math.max(0, i - window); j <= Math.min(s.length - 1, i + window); j++) if (s[j].h > best.h) best = s[j];
      return { price: best.h, t: best.t };
    },
    swingLow: (tf, clock, window = 3) => {
      const s = series(tf);
      const i = indexNear(s, t(clock));
      let best = s[i];
      for (let j = Math.max(0, i - window); j <= Math.min(s.length - 1, i + window); j++) if (s[j].l < best.l) best = s[j];
      return { price: best.l, t: best.t };
    },
    fvg: (tf, clock, direction, within = 8) => {
      const s = series(tf);
      const from = indexNear(s, t(clock));
      const slice = s.slice(Math.max(0, from - 1), from + within + 2);
      const found = fvgs(slice, tf).filter((f) => f.direction === direction);
      if (found.length === 0) {
        const nearby = fvgs(s.slice(Math.max(0, from - 12), from + 30), tf).map((f) => `${f.direction} ${tToClock(cal, f.tStart)} ${f.low}-${f.high}`);
        throw new Error(`no ${direction} ${tf} FVG within ${within} candles of ${clock}. Nearby: ${nearby.join(" | ") || "none"}`);
      }
      // The largest gap in the window is the one a person would mark.
      const best = found.reduce((a, b) => (b.high - b.low > a.high - a.low ? b : a));
      return { priceLow: best.low, priceHigh: best.high, tStart: best.tStart, tEnd: best.tEnd };
    },
    candle: (tf, clock) => {
      const s = series(tf);
      const c = s[indexNear(s, bucketStart(t(clock), tf))];
      return { priceLow: c.l, priceHigh: c.h, tStart: c.t, tEnd: c.t + TIMEFRAME_MINUTES[tf] - 1 };
    },
    extremes: (from, to) => {
      const a = t(from);
      const b = t(to);
      let high = -Infinity;
      let low = Infinity;
      let highT = a;
      let lowT = a;
      for (const c of all) {
        if (c.t < a || c.t > b) continue;
        if (c.h > high) {
          high = c.h;
          highT = c.t;
        }
        if (c.l < low) {
          low = c.l;
          lowT = c.t;
        }
      }
      return { high, low, highT, lowT };
    },
    atr: (tf, clock, n = 14) => {
      const s = series(tf);
      const i = indexNear(s, t(clock));
      return atr(s.slice(Math.max(0, i - n), i + 1), n);
    },
  };
}

export type Built = { scenario: Scenario; all: SimCandle[]; ctx: Ctx; streamStart: number };

export const DEFAULT_HISTORY: Record<string, number> = { "1D": 40, "4H": 60, "1H": 96, "15m": 128, "5m": 160 };

/** Builds the scenario's full data and reference from a spec. */
export function buildScenario(spec: ScenarioSpec): Built {
  const r = rng(spec.seed);
  const cal = spec.calendar;
  const timeline = buildTimeline(cal);

  const legs: Leg[] = [...backdropLegs(r, spec.startPrice, spec.backdrop), ...spec.legs];
  const closes: number[] = [];
  const times: number[] = [];
  const vols: number[] = [];
  const wicks: number[] = [];
  let cursor = 0;
  let price = spec.startPrice;
  for (const leg of legs) {
    const endIdx = leg.minutes !== undefined ? cursor + leg.minutes : timeline.indexOf(clockToT(cal, leg.until as Clock));
    if (endIdx < 0 || endIdx <= cursor) throw new Error(`${spec.id}: a leg ends at or before ${tToClock(cal, timeline[cursor] ?? 0)} (until ${JSON.stringify(leg.until)})`);
    const seg = timeline.slice(cursor, endIdx);
    const hist: Hist = {
      price,
      hi: (from, to) => extremeOf(times, closes, vols, wicks, cal, from, to, "hi"),
      lo: (from, to) => extremeOf(times, closes, vols, wicks, cal, from, to, "lo"),
    };
    const target = typeof leg.to === "function" ? leg.to(hist) : leg.to;
    const path = runLeg(r, price, { ...leg, to: target }, seg);
    closes.push(...path);
    times.push(...seg);
    for (let i = 0; i < seg.length; i++) {
      vols.push(leg.vol ?? 2);
      wicks.push(leg.wick ?? 1.2);
    }
    price = path[path.length - 1];
    cursor = endIdx;
  }

  const endT = clockToT(cal, spec.end);
  let last = times.findIndex((t) => t > endT);
  if (last === -1) last = times.length;
  const all = candlesFrom(r, spec.startPrice, times.slice(0, last), closes.slice(0, last), vols.slice(0, last), wicks.slice(0, last));

  // The evening session that opens the anchor trading day (a Daily boundary).
  const anchorT = clockToT(cal, [spec.anchorDay, "18:00"]);
  const ctx = makeCtx(cal, all, anchorT);

  const anchorIdx = all.findIndex((c) => c.t === anchorT);
  if (anchorIdx < 0) throw new Error(`${spec.id}: the anchor ${tToClock(cal, anchorT)} is outside the series`);
  const before = all.slice(0, anchorIdx);
  const stream = all.slice(anchorIdx);

  const budget = { ...DEFAULT_HISTORY, ...(spec.historyBars ?? {}) };
  const history: Scenario["data"]["history"] = {};
  for (const tf of ["1D", "4H", "1H", "15m", "5m"] as Timeframe[]) {
    const s = resample(before, tf);
    // Only whole buckets: the anchor is a Daily boundary, so they all are.
    history[tf] = s.slice(-(budget[tf] ?? 60)).map(toRow);
  }

  const decisionT = clockToT(cal, spec.decision);
  const cursorStart = stream.findIndex((c) => c.t === decisionT) + 1;
  if (cursorStart <= 0) throw new Error(`${spec.id}: the decision time is outside the stream`);

  const checkpoints: Checkpoints = { start: cursorStart };
  for (const [name, clock] of Object.entries(spec.checkpoints ?? {})) {
    const idx = stream.findIndex((c) => c.t === clockToT(cal, clock)) + 1;
    if (idx <= 0) throw new Error(`${spec.id}: checkpoint ${name} is outside the stream`);
    checkpoints[name] = idx;
  }

  const body = spec.build(ctx);
  const scenario: Scenario = {
    id: spec.id,
    ...body,
    cursorStart,
    checkpoints,
    provenance: { kind: "seeded", note: "Constructed price path, not market history.", generator: "scripts/scenarios/lib.ts" },
    data: { streamTimeframe: "1m", history, stream: stream.map(toRow) },
  };
  return { scenario, all, ctx, streamStart: anchorIdx };
}

/** For `inspect`: every swing and gap on a timeframe, with clocks. */
export function inspect(built: Built, tf: Timeframe, cal: Calendar, from?: Clock, to?: Clock): string[] {
  const s = built.ctx.series(tf);
  const lo = from ? clockToT(cal, from) : -Infinity;
  const hi = to ? clockToT(cal, to) : Infinity;
  const lines: string[] = [];
  for (const sw of swings(s, 2)) if (sw.t >= lo && sw.t <= hi) lines.push(`${tToClock(cal, sw.t)}  swing ${sw.kind.padEnd(4)} ${sw.price}`);
  for (const f of fvgs(s, tf, atr(s.slice(-50), 50) * 0.15)) if (f.tStart >= lo && f.tStart <= hi) lines.push(`${tToClock(cal, f.tStart)}  fvg ${f.direction} ${f.low}-${f.high} (${(f.high - f.low).toFixed(1)})`);
  return lines.sort();
}

export { fromRow, etMinutes };

// ---- Authoring helpers --------------------------------------------------
// Small constructors so a spec reads as a reading of the chart, not as object
// plumbing. They only assemble the engine's own types.


export function set<T extends string>(why: string, options: Partial<Record<T, number>>, notes: Partial<Record<T, string>> = {}): AcceptableSet<T> {
  return {
    why,
    options: (Object.entries(options) as [T, number][]).map(([value, credit]) => ({ value, credit, ...(notes[value] ? { note: notes[value] } : {}) })),
  };
}

type RefExtra = Partial<Pick<RefAnnotation, "group" | "minInGroup" | "scope" | "visibleAtRevealed" | "candidate" | "whyNot" | "decisionNote" | "priceTolerance" | "timeTolerance">>;

export function line(id: string, role: RefRole, label: string, price: number, why: string, extra: RefExtra & { t?: number; kind?: AnnotationKind } = {}): RefAnnotation {
  const { kind, t, ...rest } = extra;
  return { id, kind: kind ?? "liquidity", role, label, price, ...(t !== undefined ? { t } : {}), why, ...rest };
}

export function zone(id: string, kind: "fvg" | "ob" | "zone", role: RefRole, label: string, g: Geometry, why: string, extra: RefExtra = {}): RefAnnotation {
  return { id, kind, role, label, priceLow: g.priceLow, priceHigh: g.priceHigh, tStart: g.tStart, tEnd: g.tEnd, why, ...extra };
}

export function swingRef(id: string, kind: "swing_high" | "swing_low", role: RefRole, label: string, at: { price: number; t: number }, why: string, extra: RefExtra = {}): RefAnnotation {
  return { id, kind, role, label, price: at.price, t: at.t, why, ...extra };
}

export function band(label: string, low: number, high: number, soft: number, extra: Partial<AcceptableRange> = {}): AcceptableRange {
  return { label, low: Math.min(low, high), high: Math.max(low, high), soft, ...extra };
}

export function confluence(id: string, relevance: ConfluenceRef["relevance"], label: string, why: string): ConfluenceRef {
  return { id, relevance, label, why };
}

/** premium / discount / equilibrium for a price inside a range (45-55% is equilibrium). */
export function locate(price: number, range: { high: number; low: number }): "premium" | "discount" | "equilibrium" {
  const f = (price - range.low) / (range.high - range.low);
  return f > 0.55 ? "premium" : f < 0.45 ? "discount" : "equilibrium";
}

/** A price as a trader writes it: 21,377.5. */
export const px = (n: number): string => n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
