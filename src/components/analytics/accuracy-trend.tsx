"use client";

import { useRef, useState } from "react";
import { useRenderedWidth } from "@/hooks/use-rendered-width";
import type { TrendPoint } from "@/lib/analytics";

/** Full-size viewBox width; narrower screens get a viewBox matching their
 * width so the axis text stays at its real size. */
const MAX_W = 640;
const H = 200;
const PAD = { top: 12, right: 12, bottom: 24, left: 36 };

/** Rolling accuracy as a single line, one point per attempt. One series, so
 * no legend — the section title names it. Hover (or tap) shows the value. */
export function AccuracyTrend({ points, window }: { points: TrendPoint[]; window: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const W = Math.max(280, Math.min(MAX_W, useRenderedWidth(svgRef) ?? MAX_W));
  if (points.length < 2) {
    return (
      <p className="text-sm text-muted">
        {points.length === 1 ? `${points[0].accuracy}% so far.` : ""} The trend line appears once you have more than {window}{" "}
        attempts.
      </p>
    );
  }
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (plotW * i) / (points.length - 1);
  const y = (acc: number) => PAD.top + plotH * (1 - acc / 100);
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.accuracy).toFixed(1)}`).join(" ");
  const last = points[points.length - 1];
  const h = hover === null ? null : points[hover];

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const vx = ((e.clientX - rect.left) / rect.width) * W;
    const i = Math.round(((vx - PAD.left) / plotW) * (points.length - 1));
    setHover(Math.max(0, Math.min(points.length - 1, i)));
  }

  return (
    <div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full touch-pan-y"
        role="img"
        aria-label={`Rolling accuracy over the last ${window} attempts, now ${last.accuracy}%`}
        onPointerMove={onMove}
        onPointerDown={onMove}
        onPointerLeave={() => setHover(null)}
      >
        {[0, 50, 100].map((v) => (
          <g key={v}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} className="stroke-line" strokeWidth={1} />
            <text x={PAD.left - 6} y={y(v)} textAnchor="end" dominantBaseline="middle" className="fill-muted text-[11px]">
              {v}%
            </text>
          </g>
        ))}
        <text x={PAD.left} y={H - 6} className="fill-muted text-[11px]">
          attempt {points[0].attempt}
        </text>
        <text x={W - PAD.right} y={H - 6} textAnchor="end" className="fill-muted text-[11px]">
          attempt {last.attempt}
        </text>
        <path d={path} fill="none" className="stroke-accent" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={x(points.length - 1)} cy={y(last.accuracy)} r={4} className="fill-accent" />
        {h && hover !== null && (
          <g pointerEvents="none">
            <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + plotH} className="stroke-muted" strokeWidth={1} strokeDasharray="3 3" />
            <circle cx={x(hover)} cy={y(h.accuracy)} r={5} className="fill-accent stroke-surface" strokeWidth={2} />
          </g>
        )}
      </svg>
      <p className="mt-1 text-xs text-muted" aria-live="polite">
        {h
          ? `Attempt ${h.attempt} (${h.date}): ${h.accuracy}% over the ${window} attempts up to it.`
          : `Now ${last.accuracy}% over your last ${window} attempts. Hover or tap the line for any point.`}
      </p>
    </div>
  );
}
