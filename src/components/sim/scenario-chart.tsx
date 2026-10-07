"use client";

import { useCallback, useId, useMemo, useRef, useState } from "react";
import { CandleMarks } from "@/components/chart/candle-marks";
import { ChartTimeBackground, ChartTimeLabels } from "@/components/practice/chart-time-layer";
import type { ChartTrade, Plan, Tool } from "@/components/sim/chart-types";
import { useRenderedWidth } from "@/hooks/use-rendered-width";
import { indexAtTime, toChartCandles, type SimCandle } from "@/lib/engine/candles";
import { formatMoment, TIMEFRAME_MINUTES, type Timeframe } from "@/lib/engine/time";
import { atr } from "@/lib/engine/structure";
import type { Annotation, RefAnnotation } from "@/lib/engine/types";
import { buildChartLayout, candleIndexToX, clampToPlot, plotBounds, priceToY, slotWidth, xToCandleIndex, yToPrice, type ChartLayout } from "@/lib/coordinates";
import { buildTimeContext } from "@/lib/time-context";

const VIEWBOX_WIDTH = 900;
const VIEWBOX_HEIGHT = 500;
const MIN_VIEWBOX_WIDTH = 280;
const MIN_VIEWBOX_HEIGHT = 320;
const PRICE_TICKS = 6;
const DRAG_THRESHOLD = 6;
const HIT = 7;
const TICK = 0.25;
const ZOOM_STEPS = [30, 45, 70, 100, 150, 220];
const DEFAULT_BARS = 70;

function viewBoxFor(rendered: number): { width: number; height: number } {
  const width = Math.round(Math.min(VIEWBOX_WIDTH, Math.max(MIN_VIEWBOX_WIDTH, rendered)));
  return { width, height: Math.max(MIN_VIEWBOX_HEIGHT, Math.round((VIEWBOX_HEIGHT * width) / VIEWBOX_WIDTH)) };
}

const snap = (p: number) => Math.round(p / TICK) * TICK;
type Pt = { x: number; y: number };

export type ScenarioChartProps = {
  /** Candles of the showing timeframe, up to now (the last may still be forming). */
  series: SimCandle[];
  tf: Timeframe;
  tool: Tool;
  interactive: boolean;
  annotations: Annotation[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onCreate: (a: Omit<Annotation, "id">) => void;
  onNote: (at: { price: number; t: number }) => void;
  plan: Plan | null;
  planEditable: boolean;
  /** When the plan was placed, for where its boxes start. */
  planT: number | null;
  onPlanChange: (p: Plan) => void;
  /** Reference markings, drawn after the attempt. */
  refs?: RefAnnotation[];
  trade?: ChartTrade | null;
  /** Prices the axis must fit besides the candles (the plan, the reference). */
  extraPrices?: number[];
  /** Empty slots to the right of the newest candle. */
  futureSlots?: number;
  /** "numbered": each reference mark shows only its number and role, with the
   * full text in a legend beside the chart. "label": the mark carries its label. */
  refLabels?: "numbered" | "label";
  /** How many candles show at first. */
  defaultBars?: number;
  /** A moment to flag with a vertical line (where the user decided). */
  momentT?: number | null;
  momentLabel?: string;
  label: string;
};

/** The scenario chart: candles for any timeframe, markup in price and time
 * (so a mark means the same thing on every timeframe), a planned trade with
 * draggable stop and target, and the reference after an attempt. Uses the
 * same layout math as the practice charts (src/lib/coordinates.ts). */
export function ScenarioChart(props: ScenarioChartProps) {
  const { series, tf, tool, interactive, annotations, selectedId, plan, planT, refs, trade } = props;
  const clipId = useId();
  const svgRef = useRef<SVGSVGElement>(null);
  const rendered = useRenderedWidth(svgRef);
  const vb = viewBoxFor(rendered ?? VIEWBOX_WIDTH);
  const [barsIdx, setBarsIdx] = useState(() => {
    const i = ZOOM_STEPS.findIndex((n) => n >= (props.defaultBars ?? DEFAULT_BARS));
    return i === -1 ? ZOOM_STEPS.length - 1 : i;
  });
  const [back, setBack] = useState(0);
  const [hover, setHover] = useState<Pt | null>(null);
  const [box, setBox] = useState<{ a: Pt; b: Pt } | null>(null);
  const drag = useRef<
    | { kind: "box"; a: Pt }
    | { kind: "pan"; x: number; back: number }
    | { kind: "plan"; field: "entry" | "stop" | "target" }
    | null
  >(null);

  const bars = Math.min(ZOOM_STEPS[barsIdx] ?? DEFAULT_BARS, Math.max(series.length, 1));
  const end = Math.max(1, series.length - back);
  const start = Math.max(0, end - bars);
  const visible = useMemo(() => series.slice(start, end), [series, start, end]);
  const chartCandles = useMemo(() => toChartCandles(visible), [visible]);
  const timeContext = useMemo(() => buildTimeContext(chartCandles), [chartCandles]);
  const tfMin = TIMEFRAME_MINUTES[tf];
  const future = props.futureSlots ?? 10;

  const planPrices = useMemo(() => (plan ? [plan.stop, plan.target, ...(plan.entry === null ? [] : [plan.entry])] : []), [plan]);
  const extraKey = [...planPrices, ...(props.extraPrices ?? [])].join(",");
  const layout: ChartLayout = useMemo(
    () => buildChartLayout(chartCandles, vb.width, vb.height, { extraSlots: future, extraPrices: extraKey ? extraKey.split(",").map(Number) : [], marginRatio: 0.1 }),
    [chartCandles, vb.width, vb.height, future, extraKey],
  );
  const bounds = plotBounds(layout);
  const slot = slotWidth(layout);

  // ---- time <-> x ------------------------------------------------------
  const xAtTime = useCallback(
    (t: number, edge: "start" | "end" = "start"): number => {
      const i = indexAtTime(visible, t);
      if (i < 0) return bounds.left - 40;
      const frac = (t - visible[i].t) / tfMin;
      const f = i === visible.length - 1 ? frac : Math.min(1, frac);
      return bounds.left + slot * (i + (edge === "end" ? Math.min(1, f + 1 / tfMin) : f));
    },
    [visible, tfMin, bounds.left, slot],
  );
  const timeAtX = useCallback(
    (x: number): number => {
      const i = xToCandleIndex(layout, x);
      if (i < visible.length) return visible[i].t;
      return visible[visible.length - 1].t + (i - (visible.length - 1)) * tfMin;
    },
    [layout, visible, tfMin],
  );

  function toSvg(e: { clientX: number; clientY: number }): Pt {
    const r = svgRef.current!.getBoundingClientRect();
    return clampToPlot(layout, ((e.clientX - r.left) / r.width) * vb.width, ((e.clientY - r.top) / r.height) * vb.height);
  }

  // ---- hit testing -----------------------------------------------------
  function planLineAt(p: Pt): "entry" | "stop" | "target" | null {
    if (!plan || !props.planEditable) return null;
    const lines: ["entry" | "stop" | "target", number | null][] = [
      ["stop", plan.stop],
      ["target", plan.target],
      ["entry", plan.entry],
    ];
    for (const [field, price] of lines) if (price !== null && Math.abs(p.y - priceToY(layout, price)) <= HIT) return field;
    return null;
  }

  function annotationAt(p: Pt): Annotation | null {
    for (let i = annotations.length - 1; i >= 0; i--) {
      const a = annotations[i];
      if (a.kind === "liquidity" && a.price !== undefined) {
        if (Math.abs(p.y - priceToY(layout, a.price)) <= HIT && p.x >= xAtTime(a.t ?? visible[0].t) - 4) return a;
      } else if ((a.kind === "zone" || a.kind === "fvg" || a.kind === "ob") && a.priceLow !== undefined && a.priceHigh !== undefined && a.tStart !== undefined && a.tEnd !== undefined) {
        const x1 = xAtTime(a.tStart);
        const x2 = xAtTime(a.tEnd, "end");
        if (p.x >= x1 && p.x <= x2 && p.y >= priceToY(layout, a.priceHigh) && p.y <= priceToY(layout, a.priceLow)) return a;
      } else if ((a.kind === "swing_high" || a.kind === "swing_low" || a.kind === "note") && a.price !== undefined && a.t !== undefined) {
        if (Math.hypot(p.x - xAtTime(a.t) - slot / 2, p.y - priceToY(layout, a.price)) <= 14) return a;
      }
    }
    return null;
  }

  // ---- pointer ---------------------------------------------------------
  function onPointerDown(e: React.PointerEvent<SVGSVGElement>) {
    if (visible.length === 0) return;
    const p = toSvg(e);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Capture is a convenience; the gesture works without it.
    }
    if (tool === "cursor" || !interactive) {
      const handle = interactive ? planLineAt(p) : null;
      if (handle) {
        drag.current = { kind: "plan", field: handle };
        return;
      }
      const hit = interactive ? annotationAt(p) : null;
      if (hit) {
        props.onSelect(hit.id);
        return;
      }
      props.onSelect(null);
      drag.current = { kind: "pan", x: p.x, back };
      return;
    }
    const price = snap(yToPrice(layout, p.y));
    switch (tool) {
      case "liquidity":
        props.onCreate({ kind: "liquidity", price, t: timeAtX(p.x), tf });
        break;
      case "zone":
      case "fvg":
      case "ob":
        drag.current = { kind: "box", a: p };
        setBox({ a: p, b: p });
        break;
      case "swing_high":
      case "swing_low": {
        const i = Math.min(visible.length - 1, xToCandleIndex(layout, p.x));
        const c = visible[i];
        props.onCreate({ kind: tool, price: tool === "swing_high" ? c.h : c.l, t: c.t, tf });
        break;
      }
      case "note":
        props.onNote({ price, t: timeAtX(p.x) });
        break;
      case "long_position":
      case "short_position": {
        if (!props.planEditable) break;
        const unit = Math.max(atr(visible, 20) * 1.5, Math.abs(price) * 0.0008);
        const long = tool === "long_position";
        props.onPlanChange({
          direction: long ? "long" : "short",
          entry: price,
          stop: snap(long ? price - unit : price + unit),
          target: snap(long ? price + unit * 2.5 : price - unit * 2.5),
        });
        break;
      }
    }
  }

  function onPointerMove(e: React.PointerEvent<SVGSVGElement>) {
    if (visible.length === 0) return;
    const p = toSvg(e);
    setHover(p);
    const d = drag.current;
    if (!d) return;
    if (d.kind === "box") setBox({ a: d.a, b: p });
    else if (d.kind === "pan") {
      const shift = Math.round((d.x - p.x) / Math.max(slot, 1));
      setBack(Math.max(0, Math.min(Math.max(0, series.length - 5), d.back - shift)));
    } else if (d.kind === "plan" && plan) {
      const price = snap(yToPrice(layout, p.y));
      props.onPlanChange({ ...plan, [d.field]: price });
    }
  }

  function onPointerUp(e: React.PointerEvent<SVGSVGElement>) {
    const d = drag.current;
    drag.current = null;
    if (e.pointerType !== "mouse") setHover(null);
    if (d?.kind === "box" && box && (tool === "zone" || tool === "fvg" || tool === "ob")) {
      const x1 = Math.min(box.a.x, box.b.x);
      const x2 = Math.max(box.a.x, box.b.x);
      const y1 = Math.min(box.a.y, box.b.y);
      const y2 = Math.max(box.a.y, box.b.y);
      if (x2 - x1 >= DRAG_THRESHOLD && y2 - y1 >= DRAG_THRESHOLD) {
        const endT = timeAtX(x2) + tfMin - 1;
        props.onCreate({ kind: tool, priceLow: snap(yToPrice(layout, y2)), priceHigh: snap(yToPrice(layout, y1)), tStart: timeAtX(x1), tEnd: endT, tf });
      }
    }
    setBox(null);
  }

  const ticks = Array.from({ length: PRICE_TICKS }, (_, i) => layout.priceMin + (i / (PRICE_TICKS - 1)) * (layout.priceMax - layout.priceMin));
  const last = visible[visible.length - 1];
  const cursorClass = !interactive ? "" : tool === "cursor" ? "cursor-grab" : tool === "long_position" || tool === "short_position" ? "cursor-crosshair" : "cursor-crosshair";

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        role="img"
        aria-label={props.label}
        viewBox={`0 0 ${vb.width} ${vb.height}`}
        className={`w-full select-none touch-none [-webkit-touch-callout:none] ${cursorClass}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={(e) => {
          if (e.pointerType === "mouse" && !drag.current) setHover(null);
        }}
      >
        <defs>
          <clipPath id={clipId}>
            <rect x={bounds.left} y={bounds.top - 2} width={bounds.right - bounds.left} height={bounds.bottom - bounds.top + 4} />
          </clipPath>
        </defs>

        {ticks.map((price, i) => {
          const y = priceToY(layout, price);
          return (
            <g key={i}>
              <line x1={bounds.left} x2={bounds.right} y1={y} y2={y} className="stroke-grid" strokeWidth={1} shapeRendering="crispEdges" />
              <text x={bounds.right + 8} y={y} dominantBaseline="middle" className="chart-axis">
                {price.toFixed(0)}
              </text>
            </g>
          );
        })}

        {timeContext && <ChartTimeBackground ctx={timeContext} bounds={bounds} slotW={slot} />}

        <g clipPath={`url(#${clipId})`}>
          <CandleMarks candles={chartCandles} layout={layout} />

          {/* Reference, after the attempt. */}
          {refs?.map((r, i) => (
            <RefMark key={r.id} r={r} n={props.refLabels === "numbered" ? i + 1 : null} layout={layout} xAtTime={xAtTime} />
          ))}

          {/* The user's marks. */}
          {annotations.map((a) => (
            <UserMark key={a.id} a={a} layout={layout} xAtTime={xAtTime} selected={a.id === selectedId} slot={slot} />
          ))}

          {box && (
            <rect
              x={Math.min(box.a.x, box.b.x)}
              y={Math.min(box.a.y, box.b.y)}
              width={Math.abs(box.a.x - box.b.x)}
              height={Math.abs(box.a.y - box.b.y)}
              className="fill-foreground/10 stroke-foreground"
              strokeWidth={1.25}
              strokeDasharray="4 3"
            />
          )}

          {plan && last && <PlanMark plan={plan} layout={layout} x0={xAtTime(planT ?? last.t)} lastClose={last.c} editable={props.planEditable} />}

          {trade && <TradeMark trade={trade} layout={layout} xAtTime={xAtTime} />}
        </g>

        {timeContext && <ChartTimeLabels ctx={timeContext} bounds={bounds} slotW={slot} />}

        {props.momentT !== undefined && props.momentT !== null && visible.length > 0 && props.momentT >= visible[0].t && (
          <g pointerEvents="none">
            <line x1={xAtTime(props.momentT, "end")} x2={xAtTime(props.momentT, "end")} y1={bounds.top} y2={bounds.bottom} className="stroke-foreground/60" strokeWidth={1} strokeDasharray="6 4" />
            <text x={xAtTime(props.momentT, "end") + 4} y={bounds.bottom - 6} className="chart-tag fill-foreground">
              {props.momentLabel ?? "DECISION"}
            </text>
          </g>
        )}

        {/* Now marker: where the replay is. */}
        {last && back === 0 && interactive && (
          <g pointerEvents="none">
            <line x1={candleIndexToX(layout, visible.length - 1) + slot / 2} x2={candleIndexToX(layout, visible.length - 1) + slot / 2} y1={bounds.top} y2={bounds.bottom} className="stroke-muted/50" strokeWidth={1} strokeDasharray="2 4" />
          </g>
        )}

        {hover && interactive && (
          <g pointerEvents="none">
            <line x1={bounds.left} x2={bounds.right} y1={hover.y} y2={hover.y} className="stroke-muted" strokeWidth={1} strokeDasharray="3 3" shapeRendering="crispEdges" />
            <line x1={hover.x} x2={hover.x} y1={bounds.top} y2={bounds.bottom} className="stroke-muted" strokeWidth={1} strokeDasharray="3 3" shapeRendering="crispEdges" />
            <PriceTag x={bounds.right} y={hover.y} text={(Math.round(yToPrice(layout, hover.y) * 4) / 4).toFixed(2)} />
            <text x={Math.min(Math.max(hover.x, bounds.left + 50), bounds.right - 50)} y={bounds.top + 12} textAnchor="middle" className="chart-tag fill-muted">
              {formatMoment(timeAtX(hover.x))}
            </text>
          </g>
        )}
      </svg>

      {/* Zoom and pan. */}
      <div className="pointer-events-none absolute top-1 right-16 flex gap-1">
        {[
          { label: "◀", title: "Earlier", onClick: () => setBack((b) => Math.min(Math.max(0, series.length - 5), b + Math.max(5, Math.round(bars / 3)))) },
          { label: "▶", title: "Later", onClick: () => setBack((b) => Math.max(0, b - Math.max(5, Math.round(bars / 3)))) },
          { label: "−", title: "Show more candles", onClick: () => setBarsIdx((i) => Math.min(ZOOM_STEPS.length - 1, i + 1)) },
          { label: "+", title: "Show fewer candles", onClick: () => setBarsIdx((i) => Math.max(0, i - 1)) },
        ].map((b) => (
          <button key={b.title} type="button" title={b.title} aria-label={b.title} onClick={b.onClick} className="pointer-events-auto inline-flex h-7 w-7 items-center justify-center rounded border border-line bg-surface/90 text-xs text-muted hover:text-foreground">
            {b.label}
          </button>
        ))}
        {back > 0 && (
          <button type="button" onClick={() => setBack(0)} className="pointer-events-auto inline-flex h-7 items-center rounded border border-line bg-surface/90 px-2 text-xs text-foreground">
            Live
          </button>
        )}
      </div>
    </div>
  );
}

// ---- Marks ----------------------------------------------------------------

function PriceTag({ x, y, text, strong = false }: { x: number; y: number; text: string; strong?: boolean }) {
  const w = text.length * 6.3 + 8;
  return (
    <g pointerEvents="none">
      <rect x={x + 2} y={y - 9} width={w} height={18} rx={3} className={strong ? "fill-foreground" : "fill-muted"} />
      <text x={x + 6} y={y} dominantBaseline="middle" className="chart-axis fill-background font-medium">
        {text}
      </text>
    </g>
  );
}

const KIND_TAG: Record<string, string> = { liquidity: "LIQ", zone: "ZONE", fvg: "FVG", ob: "OB", swing_high: "SH", swing_low: "SL", note: "" };

function UserMark({ a, layout, xAtTime, selected, slot }: { a: Annotation; layout: ChartLayout; xAtTime: (t: number, edge?: "start" | "end") => number; selected: boolean; slot: number }) {
  const b = plotBounds(layout);
  const cls = selected ? "stroke-warn" : "stroke-foreground";
  const fillCls = selected ? "fill-warn" : "fill-foreground";
  if (a.kind === "liquidity" && a.price !== undefined) {
    const y = priceToY(layout, a.price);
    const x0 = Math.max(b.left, xAtTime(a.t ?? 0));
    return (
      <g>
        <line x1={x0} x2={b.right} y1={y} y2={y} className={cls} strokeWidth={selected ? 2 : 1.5} />
        <text x={x0 + 4} y={y - 4} className={`chart-tag ${fillCls}`}>
          LIQ {a.price.toFixed(2)}
        </text>
      </g>
    );
  }
  if ((a.kind === "zone" || a.kind === "fvg" || a.kind === "ob") && a.priceLow !== undefined && a.priceHigh !== undefined && a.tStart !== undefined && a.tEnd !== undefined) {
    const x1 = xAtTime(a.tStart);
    const x2 = xAtTime(a.tEnd, "end");
    const y1 = priceToY(layout, a.priceHigh);
    const y2 = priceToY(layout, a.priceLow);
    return (
      <g>
        <rect x={x1} y={y1} width={Math.max(2, x2 - x1)} height={Math.max(2, y2 - y1)} className={`fill-foreground/10 ${cls}`} strokeWidth={selected ? 2 : 1.25} />
        <text x={x1 + 3} y={y1 - 4} className={`chart-tag ${fillCls}`}>
          {KIND_TAG[a.kind]}
        </text>
      </g>
    );
  }
  if ((a.kind === "swing_high" || a.kind === "swing_low") && a.price !== undefined && a.t !== undefined) {
    const x = xAtTime(a.t) + slot / 2;
    const y = priceToY(layout, a.price);
    const high = a.kind === "swing_high";
    const d = high ? `M ${x} ${y - 4} l -5 -9 l 10 0 z` : `M ${x} ${y + 4} l -5 9 l 10 0 z`;
    return (
      <g>
        <path d={d} className={`${fillCls}`} />
        <text x={x} y={high ? y - 17 : y + 24} textAnchor="middle" className={`chart-tag ${fillCls}`}>
          {KIND_TAG[a.kind]}
        </text>
      </g>
    );
  }
  if (a.kind === "note" && a.price !== undefined && a.t !== undefined && a.text) {
    const x = xAtTime(a.t) + slot / 2;
    const y = priceToY(layout, a.price);
    const w = Math.min(180, a.text.length * 6 + 10);
    return (
      <g>
        <circle cx={x} cy={y} r={3} className={fillCls} />
        <rect x={x + 6} y={y - 9} width={w} height={18} rx={3} className="fill-surface stroke-line" />
        <text x={x + 11} y={y} dominantBaseline="middle" className="chart-tag fill-foreground">
          {a.text.slice(0, 28)}
        </text>
      </g>
    );
  }
  return null;
}

export const ROLE_STYLE: Record<RefAnnotation["role"], { stroke: string; fill: string; text: string; tag: string }> = {
  key: { stroke: "stroke-accent", fill: "fill-accent/15", text: "fill-accent", tag: "KEY" },
  valid: { stroke: "stroke-accent", fill: "fill-accent/10", text: "fill-accent", tag: "ALSO VALID" },
  supporting: { stroke: "stroke-accent/60", fill: "fill-accent/5", text: "fill-accent", tag: "SUPPORTS" },
  trap: { stroke: "stroke-warn", fill: "fill-warn/10", text: "fill-warn", tag: "LOOKS VALID, ISN'T" },
  irrelevant: { stroke: "stroke-muted", fill: "fill-muted/10", text: "fill-muted", tag: "DOESN'T MATTER" },
  invalidating: { stroke: "stroke-danger", fill: "fill-danger/10", text: "fill-danger", tag: "WEAKENS IT" },
};

function RefMark({ r, n, layout, xAtTime }: { r: RefAnnotation; n: number | null; layout: ChartLayout; xAtTime: (t: number, edge?: "start" | "end") => number }) {
  const b = plotBounds(layout);
  const s = ROLE_STYLE[r.role];
  const text = n !== null ? `${n} · ${s.tag}` : `${s.tag} · ${r.label.slice(0, 40)}`;
  if ((r.kind === "zone" || r.kind === "fvg" || r.kind === "ob") && r.priceLow !== undefined && r.priceHigh !== undefined) {
    const x1 = r.tStart !== undefined ? Math.max(b.left, xAtTime(r.tStart)) : b.left;
    const x2 = r.tEnd !== undefined ? xAtTime(r.tEnd, "end") : b.right;
    const y1 = priceToY(layout, r.priceHigh);
    const y2 = priceToY(layout, r.priceLow);
    return (
      <g pointerEvents="none">
        <rect x={x1} y={y1} width={Math.max(2, x2 - x1)} height={Math.max(2, y2 - y1)} className={`${s.fill} ${s.stroke}`} strokeWidth={1.25} strokeDasharray="5 3" />
        <text x={x1 + 3} y={y1 - 4} className={`chart-tag ${s.text}`}>
          {text}
        </text>
      </g>
    );
  }
  if (r.price === undefined) return null;
  const y = priceToY(layout, r.price);
  if (r.kind === "swing_high" || r.kind === "swing_low") {
    const x = r.t !== undefined ? xAtTime(r.t) : b.left;
    return (
      <g pointerEvents="none">
        <circle cx={x + 3} cy={y} r={5} fill="none" className={s.stroke} strokeWidth={1.5} strokeDasharray="3 2" />
        <text x={x + 10} y={y - 6} className={`chart-tag ${s.text}`}>
          {n !== null ? text : s.tag}
        </text>
      </g>
    );
  }
  const x0 = r.t !== undefined ? Math.max(b.left, xAtTime(r.t)) : b.left;
  return (
    <g pointerEvents="none">
      <line x1={x0} x2={b.right} y1={y} y2={y} className={s.stroke} strokeWidth={1.25} strokeDasharray="5 3" />
      <text x={b.right - 4} y={y - 4} textAnchor="end" className={`chart-tag ${s.text}`}>
        {text}
      </text>
    </g>
  );
}

function PlanMark({ plan, layout, x0, lastClose, editable }: { plan: Plan; layout: ChartLayout; x0: number; lastClose: number; editable: boolean }) {
  const b = plotBounds(layout);
  const entry = plan.entry ?? lastClose;
  const long = plan.direction === "long";
  const yEntry = priceToY(layout, entry);
  const yStop = priceToY(layout, plan.stop);
  const yTarget = priceToY(layout, plan.target);
  const risk = long ? entry - plan.stop : plan.stop - entry;
  const reward = long ? plan.target - entry : entry - plan.target;
  const rr = risk > 0 && reward > 0 ? reward / risk : null;
  const left = Math.max(b.left, x0);
  const w = Math.max(0, b.right - left);
  const handle = (y: number, cls: string) => editable && <rect x={b.right - 12} y={y - 5} width={10} height={10} rx={2} className={cls} />;
  return (
    <g>
      <rect x={left} y={Math.min(yEntry, yTarget)} width={w} height={Math.abs(yTarget - yEntry)} className="fill-accent/10" pointerEvents="none" />
      <rect x={left} y={Math.min(yEntry, yStop)} width={w} height={Math.abs(yStop - yEntry)} className="fill-danger/10" pointerEvents="none" />
      <line x1={left} x2={b.right} y1={yEntry} y2={yEntry} className="stroke-foreground" strokeWidth={1.5} pointerEvents="none" />
      <line x1={left} x2={b.right} y1={yStop} y2={yStop} className="stroke-danger" strokeWidth={1.5} strokeDasharray="5 3" pointerEvents="none" />
      <line x1={left} x2={b.right} y1={yTarget} y2={yTarget} className="stroke-accent" strokeWidth={1.5} strokeDasharray="5 3" pointerEvents="none" />
      <text x={left + 4} y={yEntry - 4} className="chart-tag fill-foreground" pointerEvents="none">
        {plan.direction.toUpperCase()} {plan.entry === null ? "AT MARKET" : entry.toFixed(2)}
        {rr !== null ? ` · ${rr.toFixed(1)}R` : ""}
      </text>
      <text x={left + 4} y={yStop + (long ? 12 : -4)} className="chart-tag fill-danger" pointerEvents="none">
        STOP {plan.stop.toFixed(2)}
      </text>
      <text x={left + 4} y={yTarget + (long ? -4 : 12)} className="chart-tag fill-accent" pointerEvents="none">
        TARGET {plan.target.toFixed(2)}
      </text>
      {handle(yStop, "fill-danger")}
      {handle(yTarget, "fill-accent")}
      {plan.entry !== null && handle(yEntry, "fill-foreground")}
    </g>
  );
}

function TradeMark({ trade, layout, xAtTime }: { trade: ChartTrade; layout: ChartLayout; xAtTime: (t: number, edge?: "start" | "end") => number }) {
  const b = plotBounds(layout);
  const x1 = xAtTime(trade.fillT);
  const y1 = priceToY(layout, trade.fillPrice);
  const x2 = trade.exitT !== null ? xAtTime(trade.exitT) : b.right;
  const y2 = trade.exitPrice !== null ? priceToY(layout, trade.exitPrice) : y1;
  return (
    <g pointerEvents="none">
      <line x1={x1} x2={b.right} y1={priceToY(layout, trade.stop)} y2={priceToY(layout, trade.stop)} className="stroke-danger/60" strokeWidth={1} strokeDasharray="2 4" />
      <line x1={x1} x2={b.right} y1={priceToY(layout, trade.target)} y2={priceToY(layout, trade.target)} className="stroke-accent/60" strokeWidth={1} strokeDasharray="2 4" />
      <line x1={x1} y1={y1} x2={x2} y2={y2} className="stroke-foreground" strokeWidth={1.5} />
      <circle cx={x1} cy={y1} r={4.5} className="fill-foreground" />
      {trade.exitT !== null && <circle cx={x2} cy={y2} r={4.5} fill="none" className="stroke-foreground" strokeWidth={2} />}
      <text x={x1 + 7} y={y1 + 14} className="chart-tag fill-foreground">
        FILLED {trade.fillPrice.toFixed(2)}
      </text>
    </g>
  );
}
