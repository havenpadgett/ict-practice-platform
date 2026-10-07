"use client";

import type { Tool } from "@/components/sim/chart-types";
import { TOOL_LABEL } from "@/components/sim/chart-types";
import type { AnnotationKind } from "@/lib/engine/types";

const SHORT: Record<Tool, string> = {
  cursor: "Select",
  liquidity: "Liq",
  zone: "Zone",
  fvg: "FVG",
  ob: "OB",
  swing_high: "SH",
  swing_low: "SL",
  note: "Note",
  long_position: "Long",
  short_position: "Short",
};

function Glyph({ tool }: { tool: Tool }) {
  const common = { width: 18, height: 18, viewBox: "0 0 18 18", fill: "none", stroke: "currentColor", strokeWidth: 1.5, "aria-hidden": true } as const;
  switch (tool) {
    case "cursor":
      return (
        <svg {...common}>
          <path d="M4 3l9 5-4 1.3L7.6 14z" />
        </svg>
      );
    case "liquidity":
      return (
        <svg {...common}>
          <path d="M2 9h14" strokeDasharray="3 2" />
        </svg>
      );
    case "zone":
      return (
        <svg {...common}>
          <rect x="3" y="5" width="12" height="8" />
        </svg>
      );
    case "fvg":
      return (
        <svg {...common}>
          <path d="M3 4v4M3 6h2M9 3v12M7 6h4v8H7M15 10v4M15 12h-2" />
        </svg>
      );
    case "ob":
      return (
        <svg {...common}>
          <rect x="6" y="4" width="6" height="10" />
          <path d="M9 2v2M9 14v2" />
        </svg>
      );
    case "swing_high":
      return (
        <svg {...common}>
          <path d="M9 4l5 8H4z" />
        </svg>
      );
    case "swing_low":
      return (
        <svg {...common}>
          <path d="M9 14L4 6h10z" />
        </svg>
      );
    case "note":
      return (
        <svg {...common}>
          <path d="M4 4h10M9 4v10" />
        </svg>
      );
    case "long_position":
      return (
        <svg {...common}>
          <path d="M3 14h12M9 14V4M6 7l3-3 3 3" />
        </svg>
      );
    case "short_position":
      return (
        <svg {...common}>
          <path d="M3 4h12M9 4v10M6 11l3 3 3-3" />
        </svg>
      );
  }
}

export function toolsFor(allowed: AnnotationKind[], trading: boolean): Tool[] {
  const tools: Tool[] = ["cursor"];
  for (const kind of ["liquidity", "zone", "fvg", "ob", "swing_high", "swing_low", "note"] as const) if (allowed.includes(kind)) tools.push(kind);
  if (trading) tools.push("long_position", "short_position");
  return tools;
}

/** The compact markup toolbar: one column on a wide screen, a scrolling row
 * on a phone. Every button is at least 44px. */
export function MarkupToolbar({
  tools,
  tool,
  onTool,
  onUndo,
  onDelete,
  onClear,
  canUndo,
  canDelete,
  canClear,
  disabled,
}: {
  tools: Tool[];
  tool: Tool;
  onTool: (t: Tool) => void;
  onUndo: () => void;
  onDelete: () => void;
  onClear: () => void;
  canUndo: boolean;
  canDelete: boolean;
  canClear: boolean;
  disabled?: boolean;
}) {
  const btn = "inline-flex min-h-11 min-w-11 flex-col items-center justify-center gap-0.5 rounded-md border px-1 text-[10px] leading-none transition-colors disabled:opacity-40";
  return (
    <div role="toolbar" aria-label="Markup tools" aria-orientation="vertical" className="flex gap-1 overflow-x-auto pb-1 sm:flex-col sm:overflow-visible sm:pb-0">
      {tools.map((t) => (
        <button
          key={t}
          type="button"
          title={TOOL_LABEL[t]}
          aria-label={TOOL_LABEL[t]}
          aria-pressed={tool === t}
          disabled={disabled}
          onClick={() => onTool(t)}
          className={`${btn} ${tool === t ? "border-accent bg-accent/10 text-accent" : "border-control text-muted hover:text-foreground"}`}
        >
          <Glyph tool={t} />
          {SHORT[t]}
        </button>
      ))}
      <span aria-hidden className="mx-1 w-px self-stretch bg-line sm:mx-0 sm:my-1 sm:h-px sm:w-auto" />
      <button type="button" title="Undo" aria-label="Undo" disabled={disabled || !canUndo} onClick={onUndo} className={`${btn} border-control text-muted hover:text-foreground`}>
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
          <path d="M6 5L3 8l3 3M3 8h8a4 4 0 010 8H8" />
        </svg>
        Undo
      </button>
      <button type="button" title="Delete selected mark" aria-label="Delete selected mark" disabled={disabled || !canDelete} onClick={onDelete} className={`${btn} border-control text-muted hover:text-foreground`}>
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
          <path d="M4 5h10M7 5V3h4v2M6 5l.5 10h5L12 5" />
        </svg>
        Delete
      </button>
      <button type="button" title="Clear all marks" aria-label="Clear all marks" disabled={disabled || !canClear} onClick={onClear} className={`${btn} border-control text-muted hover:text-foreground`}>
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
          <path d="M4 4l10 10M14 4L4 14" />
        </svg>
        Clear
      </button>
    </div>
  );
}
