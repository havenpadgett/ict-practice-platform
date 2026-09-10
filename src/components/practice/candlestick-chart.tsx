"use client";

import { useRef, useState } from "react";
import type { Candle } from "@/data/exercises";
import type { UserRegion } from "@/lib/grading";
import {
  buildChartLayout,
  clampToPlot,
  plotBounds,
  priceToY,
  regionToPixelRect,
  xToCandleIndex,
  yToPrice,
} from "@/lib/coordinates";

const VIEWBOX_WIDTH = 800;
const VIEWBOX_HEIGHT = 420;
const PRICE_TICK_COUNT = 5;
/** Minimum drag distance (in viewBox units) before a drag counts as a box
 * instead of a stray click — keeps a zero-area click from enabling Submit. */
const DRAG_THRESHOLD = 5;

const UP_COLOR = "#4caf82";
const DOWN_COLOR = "#e2685f";

type PixelPoint = { x: number; y: number };

export type CorrectZone = {
  price_low: number;
  price_high: number;
  candle_start: number;
  candle_end: number;
};

export function CandlestickChart({
  candles,
  interactive,
  userRegion,
  onUserRegionChange,
  correctZone,
}: {
  candles: Candle[];
  interactive: boolean;
  userRegion: UserRegion | null;
  onUserRegionChange: (region: UserRegion | null) => void;
  correctZone?: CorrectZone | null;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragStart, setDragStart] = useState<PixelPoint | null>(null);

  const layout = buildChartLayout(candles, VIEWBOX_WIDTH, VIEWBOX_HEIGHT);
  const bounds = plotBounds(layout);
  const slotW = (bounds.right - bounds.left) / candles.length;

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
    if (!interactive) return;
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
    setDragStart(point);
    onUserRegionChange(null); // clear the old box until the new drag clears the threshold
  }

  function handlePointerMove(e: React.PointerEvent<SVGSVGElement>) {
    if (!interactive || !dragStart) return;
    const point = toSvgPoint(e.clientX, e.clientY);
    const box = pixelBoxFrom(dragStart, point);
    const width = box.right - box.left;
    const height = box.bottom - box.top;
    if (width < DRAG_THRESHOLD || height < DRAG_THRESHOLD) {
      onUserRegionChange(null);
      return;
    }
    // Convert the pixel box straight into domain units on every move, so the
    // rendered box and the graded region are always the same value — there's
    // no separate "finalize" step at pointer-up.
    onUserRegionChange({
      priceLow: yToPrice(layout, box.bottom),
      priceHigh: yToPrice(layout, box.top),
      candleIndexLow: xToCandleIndex(layout, box.left),
      candleIndexHigh: xToCandleIndex(layout, box.right),
    });
  }

  function handlePointerUp() {
    setDragStart(null);
  }

  const priceTicks = Array.from({ length: PRICE_TICK_COUNT }, (_, i) => {
    const t = i / (PRICE_TICK_COUNT - 1);
    return layout.priceMin + t * (layout.priceMax - layout.priceMin);
  });

  const liveBoxRect = userRegion ? regionToPixelRect(layout, userRegion) : null;
  const correctZoneRect = correctZone
    ? regionToPixelRect(layout, {
        priceLow: correctZone.price_low,
        priceHigh: correctZone.price_high,
        candleIndexLow: correctZone.candle_start,
        candleIndexHigh: correctZone.candle_end,
      })
    : null;

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
      className={`w-full touch-none select-none ${interactive ? "cursor-crosshair" : ""}`}
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
          <g key={candle.time}>
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
          stroke="#e9eaec"
          strokeWidth={1.5}
        />
      )}
    </svg>
  );
}
