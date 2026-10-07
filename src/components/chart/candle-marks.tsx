import { memo } from "react";
import type { Candle } from "@/data/exercises";
import { plotBounds, priceToY, slotWidth, type ChartLayout } from "@/lib/coordinates";

/** The candles themselves, shared by the practice chart and the scenario
 * chart so a candle looks identical everywhere: up candles hollow, down
 * candles solid, so direction reads from shape as well as color. Memoized on
 * the data and the layout: it must not re-render on every pointer move while
 * a box or line is being dragged. */
export const CandleMarks = memo(function CandleMarks({ candles, layout }: { candles: readonly Candle[]; layout: ChartLayout }) {
  const b = plotBounds(layout);
  const w = slotWidth(layout);
  return (
    <>
      {candles.map((candle, index) => {
        const x = b.left + w * index + w / 2;
        const bodyTop = priceToY(layout, Math.max(candle.open, candle.close));
        const bodyBottom = priceToY(layout, Math.min(candle.open, candle.close));
        const up = candle.close >= candle.open;
        const bodyWidth = Math.max(1.5, w * 0.62);
        return (
          // Index, not time: multi-day real data repeats "HH:MM" labels.
          <g key={index}>
            <line
              x1={x}
              x2={x}
              y1={priceToY(layout, candle.high)}
              y2={priceToY(layout, candle.low)}
              className={up ? "stroke-candle-up" : "stroke-candle-down"}
              strokeWidth={1}
              shapeRendering="crispEdges"
            />
            <rect
              x={x - bodyWidth / 2}
              y={bodyTop}
              width={bodyWidth}
              height={Math.max(1, bodyBottom - bodyTop)}
              rx={Math.min(1, bodyWidth / 6)}
              className={up ? "fill-surface stroke-candle-up" : "fill-candle-down"}
              strokeWidth={up ? 1 : undefined}
            />
          </g>
        );
      })}
    </>
  );
});
