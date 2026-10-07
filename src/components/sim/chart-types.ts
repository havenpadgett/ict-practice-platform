import type { Timeframe } from "@/lib/engine/time";
import type { Direction } from "@/lib/engine/types";

export type { Direction, Timeframe };

/** What the pointer does on the chart. */
export type Tool = "cursor" | "liquidity" | "zone" | "fvg" | "ob" | "swing_high" | "swing_low" | "note" | "long_position" | "short_position";

export const TOOL_LABEL: Record<Tool, string> = {
  cursor: "Select / pan",
  liquidity: "Liquidity line",
  zone: "Zone",
  fvg: "FVG",
  ob: "Order block",
  swing_high: "Swing high",
  swing_low: "Swing low",
  note: "Note",
  long_position: "Long position",
  short_position: "Short position",
};

/** The trade being planned. Entry null = at market. */
export type Plan = { direction: Direction; entry: number | null; stop: number; target: number };

/** A trade that happened, drawn on the review chart. */
export type ChartTrade = {
  direction: Direction;
  fillT: number;
  fillPrice: number;
  exitT: number | null;
  exitPrice: number | null;
  stop: number;
  target: number;
};
