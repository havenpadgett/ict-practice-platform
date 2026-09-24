"use client";

import { useRef, useState } from "react";
import type { Candle } from "@/data/exercises";
import { ChartTimeBackground, ChartTimeLabels } from "@/components/practice/chart-time-layer";
import type { UserRegion } from "@/lib/grading";
import { buildTimeContext } from "@/lib/time-context";
import {
  buildChartLayout,
  candleIndexToX,
  clampToPlot,
  plotBounds,
  priceToY,
  regionToPixelRect,
  slotWidth,
  xToCandleIndex,
  yToPrice,
} from "@/lib/coordinates";

const VIEWBOX_WIDTH = 800;
const VIEWBOX_HEIGHT = 420;
const PRICE_TICK_COUNT = 5;
/** Minimum drag distance (in viewBox units) before a box-drag counts as a
 * box instead of a stray click — keeps a zero-area click from enabling
 * Submit. A single click IS a complete answer for level mode, so no
 * threshold applies there. */
const DRAG_THRESHOLD = 5;

const UP_COLOR = "#4caf82";
const DOWN_COLOR = "#e2685f";
const USER_MARK_COLOR = "#e9eaec";
/** Free Trade gets a little more headroom than the default so a stop just
 * beyond the revealed swing extreme can still be placed. Symmetric, so it
 * says nothing about which way price goes next. */
const FREE_PRICE_MARGIN_RATIO = 0.14;

type PixelPoint = { x: number; y: number };

export type CorrectZone = {
  price_low: number;
  price_high: number;
  candle_start: number;
  candle_end: number;
};

type CommonProps = {
  candles: Candle[];
  interactive: boolean;
};

type ZoneProps = CommonProps & {
  answerType: "zone";
  userRegion: UserRegion | null;
  onUserRegionChange: (region: UserRegion | null) => void;
  correctZone?: CorrectZone | null;
};

type LevelProps = CommonProps & {
  answerType: "level";
  userLevel: number | null;
  onUserLevelChange: (price: number | null) => void;
  correctLevel?: number | null;
};

/** No drawing at all — the chart is purely observational. Choice exercises
 * (FVG respected/disrespected) test whether the user can read price action
 * after a gap that's already shown, not whether they can find it, so the
 * gap is highlighted from the start rather than revealed after grading. */
type ChoiceProps = CommonProps & {
  answerType: "choice";
  fvgZone: CorrectZone;
};

export type GuidedLevelField = "entry" | "stop" | "target";

/** Guided Entry places up to three simultaneous horizontal lines (entry,
 * stop, target) instead of one — only `activeField` responds to pointer
 * input at a time (the earlier steps' lines are already frozen), and
 * `activeField` is null entirely during the bias step, when there's
 * nothing on the chart to place yet. */
type GuidedProps = CommonProps & {
  answerType: "guided";
  entryPrice: number | null;
  stopPrice: number | null;
  targetPrice: number | null;
  activeField: GuidedLevelField | null;
  onActiveFieldChange: (price: number) => void;
  correctEntry?: number | null;
  correctStop?: number | null;
  correctTarget?: number | null;
};

/** Free Trade playback: only revealed candles are passed in (the chart
 * scales to them alone, so the axis never hints at future price), with a
 * few empty slots to the right. Once a Long/Short is opened, the stop and
 * target are placed as horizontal lines — same interaction as Guided
 * Entry's levels, with `activeField` choosing which one pointer input
 * moves. After grading, the ideal entry zone / stop zone / target overlay
 * the fully revealed chart. */
type FreeProps = CommonProps & {
  answerType: "free";
  extraSlots: number;
  entryPrice: number | null;
  stopPrice: number | null;
  targetPrice: number | null;
  activeField: "stop" | "target" | null;
  onActiveFieldChange: (price: number) => void;
  entryIndex: number | null;
  exit: { index: number; price: number } | null;
  idealEntryZone?: { price_low: number; price_high: number; candle_start: number } | null;
  idealStopZone?: { price_low: number; price_high: number } | null;
  idealTarget?: number | null;
};

const GUIDED_FIELD_LABELS: Record<GuidedLevelField, string> = {
  entry: "ENTRY",
  stop: "STOP",
  target: "TARGET",
};

export function CandlestickChart(props: ZoneProps | LevelProps | ChoiceProps | GuidedProps | FreeProps) {
  const { candles, interactive } = props;
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragStart, setDragStart] = useState<PixelPoint | null>(null);
  const [isPlacingLevel, setIsPlacingLevel] = useState(false);

  // Guided Entry and Free Trade both place labeled horizontal lines, one
  // "active" field at a time; nothing is placeable while activeField is null.
  const isMultiLine = props.answerType === "guided" || props.answerType === "free";
  const hasActiveField = isMultiLine && props.activeField !== null;

  const freeOverlayPrices =
    props.answerType === "free"
      ? [
          ...(props.idealStopZone ? [props.idealStopZone.price_low, props.idealStopZone.price_high] : []),
          ...(props.idealTarget !== null && props.idealTarget !== undefined ? [props.idealTarget] : []),
        ]
      : [];
  const layout = buildChartLayout(
    candles,
    VIEWBOX_WIDTH,
    VIEWBOX_HEIGHT,
    props.answerType === "free"
      ? { extraSlots: props.extraSlots, extraPrices: freeOverlayPrices, marginRatio: FREE_PRICE_MARGIN_RATIO }
      : {},
  );
  const bounds = plotBounds(layout);
  const slotW = slotWidth(layout);
  // Null for constructed exercises without timestamps — no time layer.
  const timeContext = buildTimeContext(candles);

  // Browser pointer events report coordinates in real screen pixels, but our
  // layout math lives in the SVG's viewBox units. This converts one to the
  // other using the ratio between the element's rendered size and its
  // viewBox size, so dragging works the same at any responsive width.
  function toSvgPoint(clientX: number, clientY: number): PixelPoint {
    const rect = svgRef.current!.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * VIEWBOX_WIDTH;
    const y = ((clientY - rect.top) / rect.height) * VIEWBOX_HEIGHT;
    return clampToPlot(layout, x, y);
  }

  function pixelBoxFrom(a: PixelPoint, b: PixelPoint) {
    return {
      left: Math.min(a.x, b.x),
      right: Math.max(a.x, b.x),
      top: Math.min(a.y, b.y),
      bottom: Math.max(a.y, b.y),
    };
  }

  function handlePointerDown(e: React.PointerEvent<SVGSVGElement>) {
    if (!interactive || props.answerType === "choice") return;
    if (isMultiLine && !hasActiveField) return;
    // Pointer capture keeps the drag going even if the pointer slips past
    // the SVG's edge mid-drag. It can throw in some browsers/devices when
    // there's no "active pointer" session to capture — that's not fatal,
    // so the drag itself must not depend on it succeeding.
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Continue without capture.
    }
    const point = toSvgPoint(e.clientX, e.clientY);
    if (props.answerType === "level") {
      // A single click already places a complete answer — no drag
      // threshold needed, unlike a box which needs width and height.
      setIsPlacingLevel(true);
      props.onUserLevelChange(yToPrice(layout, point.y));
      return;
    }
    if (props.answerType === "guided" || props.answerType === "free") {
      setIsPlacingLevel(true);
      props.onActiveFieldChange(yToPrice(layout, point.y));
      return;
    }
    setDragStart(point);
    props.onUserRegionChange(null); // clear the old box until the new drag clears the threshold
  }

  function handlePointerMove(e: React.PointerEvent<SVGSVGElement>) {
    if (!interactive || props.answerType === "choice") return;
    if (isMultiLine && !hasActiveField) return;
    const point = toSvgPoint(e.clientX, e.clientY);

    if (props.answerType === "level") {
      if (!isPlacingLevel) return;
      props.onUserLevelChange(yToPrice(layout, point.y));
      return;
    }
    if (props.answerType === "guided" || props.answerType === "free") {
      if (!isPlacingLevel) return;
      props.onActiveFieldChange(yToPrice(layout, point.y));
      return;
    }

    if (!dragStart) return;
    const box = pixelBoxFrom(dragStart, point);
    const width = box.right - box.left;
    const height = box.bottom - box.top;
    if (width < DRAG_THRESHOLD || height < DRAG_THRESHOLD) {
      props.onUserRegionChange(null);
      return;
    }
    // Convert the pixel box straight into domain units on every move, so the
    // rendered box and the graded region are always the same value — there's
    // no separate "finalize" step at pointer-up.
    props.onUserRegionChange({
      priceLow: yToPrice(layout, box.bottom),
      priceHigh: yToPrice(layout, box.top),
      candleIndexLow: xToCandleIndex(layout, box.left),
      candleIndexHigh: xToCandleIndex(layout, box.right),
    });
  }

  function handlePointerUp() {
    setDragStart(null);
    setIsPlacingLevel(false);
  }

  const priceTicks = Array.from({ length: PRICE_TICK_COUNT }, (_, i) => {
    const t = i / (PRICE_TICK_COUNT - 1);
    return layout.priceMin + t * (layout.priceMax - layout.priceMin);
  });

  const liveBoxRect =
    props.answerType === "zone" && props.userRegion
      ? regionToPixelRect(layout, props.userRegion)
      : null;
  const zoneToShow =
    props.answerType === "zone" ? props.correctZone : props.answerType === "choice" ? props.fvgZone : null;
  const correctZoneRect = zoneToShow
    ? regionToPixelRect(layout, {
        priceLow: zoneToShow.price_low,
        priceHigh: zoneToShow.price_high,
        candleIndexLow: zoneToShow.candle_start,
        candleIndexHigh: zoneToShow.candle_end,
      })
    : null;

  const userLevelY =
    props.answerType === "level" && props.userLevel !== null
      ? priceToY(layout, props.userLevel)
      : null;
  const correctLevelY =
    props.answerType === "level" && props.correctLevel !== null && props.correctLevel !== undefined
      ? priceToY(layout, props.correctLevel)
      : null;

  // Guided Entry's three possible lines (entry/stop/target), each shown in
  // both its user-placed and (post-grading) correct-answer form — same
  // rendering as a single Liquidity level, just three of them with a label
  // distinguishing which is which.
  const guidedFields: GuidedLevelField[] = ["entry", "stop", "target"];
  const guidedUserPrices: Record<GuidedLevelField, number | null> =
    props.answerType === "guided" || props.answerType === "free"
      ? { entry: props.entryPrice, stop: props.stopPrice, target: props.targetPrice }
      : { entry: null, stop: null, target: null };
  const guidedCorrectPrices: Record<GuidedLevelField, number | null | undefined> =
    props.answerType === "guided"
      ? { entry: props.correctEntry, stop: props.correctStop, target: props.correctTarget }
      : { entry: null, stop: null, target: null };

  const cursorClass =
    !interactive || props.answerType === "choice"
      ? ""
      : props.answerType === "level" || hasActiveField
        ? "cursor-row-resize"
        : isMultiLine
          ? ""
          : "cursor-crosshair";

  // Choice charts have nothing to drag, so the page should still scroll
  // normally when a touch starts on the chart — touch-action: none is only
  // needed to keep a drawing gesture from also panning the page. Same for a
  // guided step with nothing currently placeable (the bias step).
  const touchClass =
    props.answerType === "choice" || (isMultiLine && !hasActiveField)
      ? ""
      : "touch-none [-webkit-touch-callout:none]";

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
      className={`w-full select-none ${touchClass} ${cursorClass}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {/* Price axis gridlines + labels */}
      {priceTicks.map((price) => {
        const y = priceToY(layout, price);
        return (
          <g key={price}>
            <line
              x1={bounds.left}
              x2={bounds.right}
              y1={y}
              y2={y}
              className="stroke-line"
              strokeWidth={1}
            />
            <text
              x={bounds.right + 8}
              y={y}
              dominantBaseline="middle"
              className="fill-muted text-[11px]"
            >
              {price.toFixed(0)}
            </text>
          </g>
        );
      })}

      {timeContext && <ChartTimeBackground ctx={timeContext} bounds={bounds} slotW={slotW} />}

      {/* Candles */}
      {candles.map((candle, index) => {
        const x = bounds.left + slotW * index + slotW / 2;
        const bodyTop = priceToY(layout, Math.max(candle.open, candle.close));
        const bodyBottom = priceToY(layout, Math.min(candle.open, candle.close));
        const wickTop = priceToY(layout, candle.high);
        const wickBottom = priceToY(layout, candle.low);
        const color = candle.close >= candle.open ? UP_COLOR : DOWN_COLOR;
        const bodyWidth = slotW * 0.6;

        return (
          // Index, not time: multi-day real data repeats "HH:MM" labels.
          <g key={index}>
            <line
              x1={x}
              x2={x}
              y1={wickTop}
              y2={wickBottom}
              stroke={color}
              strokeWidth={1}
            />
            <rect
              x={x - bodyWidth / 2}
              y={bodyTop}
              width={bodyWidth}
              height={Math.max(1, bodyBottom - bodyTop)}
              fill={color}
            />
          </g>
        );
      })}

      {timeContext && <ChartTimeLabels ctx={timeContext} bounds={bounds} slotW={slotW} />}

      {/* The true zone, shown only after grading */}
      {correctZoneRect && (
        <rect
          x={correctZoneRect.left}
          y={correctZoneRect.top}
          width={correctZoneRect.right - correctZoneRect.left}
          height={correctZoneRect.bottom - correctZoneRect.top}
          className="fill-accent/20 stroke-accent"
          strokeWidth={1.5}
          strokeDasharray="4 3"
        />
      )}

      {/* The user's drawn box — live while dragging, frozen after submit */}
      {liveBoxRect && (
        <rect
          x={liveBoxRect.left}
          y={liveBoxRect.top}
          width={liveBoxRect.right - liveBoxRect.left}
          height={liveBoxRect.bottom - liveBoxRect.top}
          fill="rgba(233, 234, 236, 0.12)"
          stroke={USER_MARK_COLOR}
          strokeWidth={1.5}
        />
      )}

      {/* The true level, shown only after grading */}
      {correctLevelY !== null && (
        <line
          x1={bounds.left}
          x2={bounds.right}
          y1={correctLevelY}
          y2={correctLevelY}
          className="stroke-accent"
          strokeWidth={1.5}
          strokeDasharray="4 3"
        />
      )}

      {/* The user's placed line — live while dragging, frozen after submit */}
      {userLevelY !== null && (
        <line
          x1={bounds.left}
          x2={bounds.right}
          y1={userLevelY}
          y2={userLevelY}
          stroke={USER_MARK_COLOR}
          strokeWidth={1.5}
        />
      )}

      {/* Free Trade, after grading: ideal entry zone (from the candle the
          setup completes on), stop zone, and target. */}
      {props.answerType === "free" && props.idealEntryZone && (
        <g>
          <rect
            x={candleIndexToX(layout, props.idealEntryZone.candle_start) - slotW / 2}
            y={priceToY(layout, props.idealEntryZone.price_high)}
            width={bounds.right - (candleIndexToX(layout, props.idealEntryZone.candle_start) - slotW / 2)}
            height={priceToY(layout, props.idealEntryZone.price_low) - priceToY(layout, props.idealEntryZone.price_high)}
            className="fill-accent/15 stroke-accent"
            strokeWidth={1}
            strokeDasharray="4 3"
          />
          <text
            x={candleIndexToX(layout, props.idealEntryZone.candle_start) - slotW / 2 + 4}
            y={priceToY(layout, props.idealEntryZone.price_high) - 4}
            className="fill-accent text-[10px] font-medium"
          >
            IDEAL ENTRY
          </text>
        </g>
      )}
      {props.answerType === "free" && props.idealStopZone && (
        <g>
          <rect
            x={bounds.left}
            y={priceToY(layout, props.idealStopZone.price_high)}
            width={bounds.right - bounds.left}
            height={priceToY(layout, props.idealStopZone.price_low) - priceToY(layout, props.idealStopZone.price_high)}
            fill={DOWN_COLOR}
            fillOpacity={0.12}
            stroke={DOWN_COLOR}
            strokeWidth={1}
            strokeDasharray="4 3"
          />
          <text
            x={bounds.left + 4}
            y={priceToY(layout, props.idealStopZone.price_high) - 4}
            fill={DOWN_COLOR}
            className="text-[10px] font-medium"
          >
            STOP ZONE
          </text>
        </g>
      )}
      {props.answerType === "free" && props.idealTarget !== null && props.idealTarget !== undefined && (
        <g>
          <line
            x1={bounds.left}
            x2={bounds.right}
            y1={priceToY(layout, props.idealTarget)}
            y2={priceToY(layout, props.idealTarget)}
            className="stroke-accent"
            strokeWidth={1.5}
            strokeDasharray="4 3"
          />
          <text
            x={bounds.left + 4}
            y={priceToY(layout, props.idealTarget) - 4}
            className="fill-accent text-[10px] font-medium"
          >
            IDEAL TARGET
          </text>
        </g>
      )}

      {/* Free Trade: entry fill and exit markers. */}
      {props.answerType === "free" && props.entryIndex !== null && props.entryPrice !== null && (
        <circle
          cx={candleIndexToX(layout, props.entryIndex)}
          cy={priceToY(layout, props.entryPrice)}
          r={4}
          fill={USER_MARK_COLOR}
        />
      )}
      {props.answerType === "free" && props.exit && (
        <circle
          cx={candleIndexToX(layout, props.exit.index)}
          cy={priceToY(layout, props.exit.price)}
          r={4}
          fill="none"
          stroke={USER_MARK_COLOR}
          strokeWidth={2}
        />
      )}

      {/* Guided Entry / Free Trade: up to three labeled lines (entry/stop/
          target), each in its user-placed and — once graded (Guided only) —
          correct-answer form. */}
      {isMultiLine &&
        guidedFields.map((field) => {
          const userPrice = guidedUserPrices[field];
          const correctPrice = guidedCorrectPrices[field];
          return (
            <g key={field}>
              {correctPrice !== null && correctPrice !== undefined && (
                <g>
                  <line
                    x1={bounds.left}
                    x2={bounds.right}
                    y1={priceToY(layout, correctPrice)}
                    y2={priceToY(layout, correctPrice)}
                    className="stroke-accent"
                    strokeWidth={1.5}
                    strokeDasharray="4 3"
                  />
                  <text
                    x={bounds.left + 4}
                    y={priceToY(layout, correctPrice) - 4}
                    className="fill-accent text-[10px] font-medium"
                  >
                    {GUIDED_FIELD_LABELS[field]} (correct)
                  </text>
                </g>
              )}
              {userPrice !== null && (
                <g>
                  <line
                    x1={bounds.left}
                    x2={bounds.right}
                    y1={priceToY(layout, userPrice)}
                    y2={priceToY(layout, userPrice)}
                    stroke={USER_MARK_COLOR}
                    strokeWidth={1.5}
                  />
                  <text
                    x={bounds.left + 90}
                    y={priceToY(layout, userPrice) - 4}
                    className="fill-foreground text-[10px] font-medium"
                  >
                    {GUIDED_FIELD_LABELS[field]}
                  </text>
                </g>
              )}
            </g>
          );
        })}
    </svg>
  );
}
