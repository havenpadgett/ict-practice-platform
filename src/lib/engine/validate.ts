// Scenario validation: structural checks on the data and on the reference
// analysis, and the check that matters most for authoring honesty: every
// reference marking sits on structure that actually exists in the candles.
// The build script refuses to write a scenario that fails; a test runs it
// over every shipped scenario.

import { fromRow, resample, supportedTimeframes, type SimCandle } from "@/lib/engine/candles";
import { SCORED_KINDS } from "@/lib/engine/accept";
import { supportedModes } from "@/lib/engine/modes";
import { fvgs, swings } from "@/lib/engine/structure";
import { bucketStart, TIMEFRAMES, TIMEFRAME_MINUTES, type Timeframe } from "@/lib/engine/time";
import { plannedRR, simulateOrder } from "@/lib/engine/trade";
import type { Order, RefAnnotation, Scenario } from "@/lib/engine/types";

function ascending(candles: SimCandle[], label: string, errors: string[]): void {
  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    if (!(c.h >= Math.max(c.o, c.c) && c.l <= Math.min(c.o, c.c))) errors.push(`${label}[${i}]: high/low do not contain open/close`);
    if (i > 0 && candles[i].t <= candles[i - 1].t) errors.push(`${label}[${i}]: time does not increase`);
  }
}

/** Series on `tf` from history + the whole stream: the structure a reference
 * mark may point at. */
function fullSeries(s: Scenario, tf: Timeframe): SimCandle[] {
  const history = (s.data.history[tf] ?? []).map(fromRow);
  const stream = s.data.stream.map(fromRow);
  if (tf === s.data.streamTimeframe) return [...history, ...stream];
  const live = resample(stream, tf);
  const last = history[history.length - 1];
  return [...history, ...(last ? live.filter((c) => c.t > last.t) : live)];
}

function nearSwing(s: Scenario, price: number, tol: number, t?: number, timeTol?: number): boolean {
  for (const tf of ["1H", "15m", "5m"] as Timeframe[]) {
    const series = fullSeries(s, tf);
    for (const sw of swings(series, 2)) {
      if (Math.abs(sw.price - price) > tol) continue;
      if (t !== undefined && Math.abs(sw.t - t) > (timeTol ?? 180) + TIMEFRAME_MINUTES[tf]) continue;
      return true;
    }
  }
  // Daily and 4H extremes count too (previous day high, 4H swing).
  for (const tf of ["1D", "4H"] as Timeframe[]) {
    for (const c of fullSeries(s, tf)) if (Math.abs(c.h - price) <= tol || Math.abs(c.l - price) <= tol) return true;
  }
  return false;
}

function liquidityExists(s: Scenario, price: number, tol: number): boolean {
  if (nearSwing(s, price, tol)) return true;
  // Session extremes (overnight, Asia) are highs or lows of a stretch, not fractal swings.
  for (const tf of ["1H", "15m", "5m", "1m"] as Timeframe[]) for (const c of fullSeries(s, tf)) if (Math.abs(c.h - price) <= tol || Math.abs(c.l - price) <= tol) return true;
  return false;
}

function zoneExists(s: Scenario, r: RefAnnotation): boolean {
  if (r.priceLow === undefined || r.priceHigh === undefined) return false;
  const height = r.priceHigh - r.priceLow;
  for (const tf of ["1D", "4H", "1H", "15m", "5m", "1m"] as Timeframe[]) {
    const series = fullSeries(s, tf);
    if (r.kind === "fvg") {
      for (const f of fvgs(series, tf)) {
        const overlap = Math.min(f.high, r.priceHigh) - Math.max(f.low, r.priceLow);
        if (overlap >= 0.8 * Math.min(height, f.high - f.low) && (r.tStart === undefined || (f.tEnd >= r.tStart && f.tStart <= (r.tEnd ?? r.tStart)))) return true;
      }
    } else {
      // An order block or plain zone is a candle range: some candle must overlap it heavily.
      for (const c of series) {
        const overlap = Math.min(c.h, r.priceHigh) - Math.max(c.l, r.priceLow);
        if (overlap >= 0.6 * height && (r.tStart === undefined || (c.t + TIMEFRAME_MINUTES[tf] - 1 >= r.tStart && c.t <= (r.tEnd ?? r.tStart)))) return true;
      }
    }
  }
  return false;
}

export type ValidateOptions = { ideal?: { order: Order; expect: "target" | "stop" | "unfilled" } };

/** Returns every problem found; an empty list means the scenario is sound. */
export function validateScenario(s: Scenario, options: ValidateOptions = {}): string[] {
  const errors: string[] = [];
  const stream = s.data.stream.map(fromRow);
  if (!s.id) errors.push("missing id");
  if (stream.length < 60) errors.push("stream is too short");
  ascending(stream, "stream", errors);
  if (stream[0] && bucketStart(stream[0].t, "1D") !== stream[0].t) errors.push("stream does not start on a Daily boundary (18:00 ET)");
  if (!(s.cursorStart > 0 && s.cursorStart < stream.length)) errors.push("cursorStart is outside the stream");
  for (const [name, idx] of Object.entries(s.checkpoints)) if (!(idx > 0 && idx <= stream.length)) errors.push(`checkpoint ${name} is outside the stream`);

  for (const tf of TIMEFRAMES) {
    const rows = (s.data.history[tf] ?? []).map(fromRow);
    ascending(rows, `history.${tf}`, errors);
    const last = rows[rows.length - 1];
    if (last && stream[0] && last.t >= stream[0].t) errors.push(`history.${tf} overlaps the stream`);
    for (const c of rows) if (bucketStart(c.t, tf) !== c.t) errors.push(`history.${tf} has a misaligned bucket`);
  }

  const history = Object.fromEntries(Object.entries(s.data.history).map(([k, v]) => [k, (v ?? []).map(fromRow)]));
  const supported = supportedTimeframes({ history, stream, streamTimeframe: s.data.streamTimeframe }, s.cursorStart);
  if (s.provenance.kind === "seeded" && supported.length < 6) errors.push(`only ${supported.join(", ")} are supported at the decision moment`);

  const ref = s.reference;
  const ids = new Set<string>();
  for (const a of ref.annotations) {
    if (ids.has(a.id)) errors.push(`duplicate reference id ${a.id}`);
    ids.add(a.id);
    if (!SCORED_KINDS.includes(a.kind)) errors.push(`${a.id}: kind ${a.kind} is not scored`);
    if (a.kind === "fvg" || a.kind === "ob" || a.kind === "zone") {
      if (a.priceLow === undefined || a.priceHigh === undefined || a.priceLow >= a.priceHigh) errors.push(`${a.id}: zone needs priceLow < priceHigh`);
      else if (!zoneExists(s, a)) errors.push(`${a.id}: no ${a.kind} on the chart matches this zone`);
    } else if (a.price === undefined) {
      errors.push(`${a.id}: needs a price`);
    } else if (a.kind === "liquidity") {
      if (!liquidityExists(s, a.price, a.priceTolerance ?? 12)) errors.push(`${a.id}: no swing, high or low on the chart sits at ${a.price}`);
    } else if (!nearSwing(s, a.price, a.priceTolerance ?? 12, a.t, a.timeTolerance)) errors.push(`${a.id}: no ${a.kind} on the chart sits at ${a.price}`);
  }
  for (const group of new Set(ref.annotations.map((a) => a.group).filter(Boolean))) {
    if (ref.annotations.filter((a) => a.group === group).length < 2) errors.push(`group ${group} has a single member: it needs alternatives`);
  }
  const hasFull = (set: { options: { credit: number }[] }) => set.options.some((o) => o.credit >= 1);
  if (!hasFull(ref.bias)) errors.push("bias has no fully valid option");
  if (!hasFull(ref.decision)) errors.push("decision has no fully valid option");
  for (const [key, set] of Object.entries(ref.answers)) if (!hasFull(set)) errors.push(`answer ${key} has no fully valid option`);
  for (const [key, ranges] of Object.entries(ref.ranges)) for (const r of ranges) if (!(r.low < r.high)) errors.push(`range ${key}/${r.label}: low must be below high`);

  const trade = ref.trade;
  if (trade) {
    const long = trade.direction === "long";
    if (trade.entry.length === 0 || trade.targets.length === 0) errors.push("trade needs entry areas and targets");
    for (const e of trade.entry) {
      if (!(e.low < e.high)) errors.push(`entry ${e.label}: low must be below high`);
      if (long ? trade.stop.invalidation >= e.low : trade.stop.invalidation <= e.high) errors.push(`entry ${e.label}: the invalidation level must be beyond the entry area`);
    }
    for (const t of trade.targets) for (const e of trade.entry) if (long ? t.low <= e.high : t.high >= e.low) errors.push(`target ${t.label} overlaps entry ${e.label}`);
    if (trade.confirmedAtRevealed !== null && !(trade.confirmedAtRevealed > 0 && trade.confirmedAtRevealed <= stream.length)) errors.push("confirmedAtRevealed is outside the stream");
  }
  if (!trade && ref.decision.options.some((o) => o.credit >= 1 && (o.value === "long" || o.value === "short"))) errors.push("decision rewards a trade but the reference has none");
  if (trade && !ref.decision.options.some((o) => o.value === trade.direction && o.credit > 0)) errors.push("the reference trade's direction earns no decision credit");

  if (options.ideal) {
    const outcome = simulateOrder(options.ideal.order, stream, s.data.streamTimeframe);
    const got = outcome.status === "closed" ? (outcome.exit === "target" ? "target" : outcome.exit === "stop" ? "stop" : "end") : "unfilled";
    if (got !== options.ideal.expect) errors.push(`ideal order should end at ${options.ideal.expect} but ended at ${got}`);
    const o = options.ideal.order;
    if (trade && o.entry !== null) {
      const rr = plannedRR(o.direction, o.entry, o.stop, o.target);
      if (rr === null || rr < trade.minRR) errors.push(`the ideal order plans ${rr === null ? "no" : rr.toFixed(2)}R, under the ${trade.minRR}R minimum the reference asks for`);
      if (outcome.status === "closed" && outcome.fillIndex < (trade.confirmedAtRevealed ?? 0) && trade.confirmedAtRevealed !== null) errors.push("the ideal order fills before confirmation");
    }
  }

  if (supportedModes(s).length < 3) errors.push("scenario supports fewer than three modes");
  return errors;
}
